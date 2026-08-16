/**
 * 🎬 Klientsidig videokomprimering (WebCodecs) + posterbild.
 *
 * VARFÖR: En rå mobilvideo är 20–50 MB. Den lagras en gång men skickas ut varje
 * gång någon tittar — bandbredden är den verkliga kostnaden i skala. Genom att
 * komprimera till 720p H.264 direkt i användarens enhet innan uppladdning
 * kapas både lagring och trafik med 60–80 %, och filen blir dessutom spelbar
 * på alla plattformar (iPhone spelar in HEVC/MOV som inte alltid går att spela
 * upp i Chrome/Android).
 *
 * DESIGNPRINCIPER
 * - Aldrig blockera användaren: misslyckas komprimeringen laddas originalet upp.
 * - Poster (första bildrutan) genereras alltid när det går – listor och kort kan
 *   då visa en ~20 kB JPEG i stället för att röra videofilen alls.
 * - All tung kodning sker i enheten. Ingen serverkostnad, ingen väntetid på moln.
 */

import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

export interface TranscodeOptions {
  /** Kortsidan i pixlar (720 = "720p" oavsett stående/liggande). */
  shortSide?: number;
  /** Målbitrate för video i bit/s. */
  videoBitrate?: number;
  /** Progress 0–1 under kodningen. */
  onProgress?: (ratio: number) => void;
}

export interface TranscodeResult {
  /** Videofilen som ska laddas upp (komprimerad eller originalet). */
  blob: Blob;
  /** Filändelse som matchar blob. */
  extension: string;
  /** Posterbild (JPEG) ur första bildrutan, eller null. */
  poster: Blob | null;
  /** True om komprimeringen faktiskt kördes. */
  transcoded: boolean;
  /**
   * True om filen garanterat går att spela upp på alla plattformar
   * (H.264 i MP4/MOV). False = t.ex. HEVC från iPhone, som Android och
   * Windows inte kan avkoda — då får filen inte lagras.
   */
  playableEverywhere: boolean;
  /** Videokodek i källfilen, för felmeddelanden och loggning. */
  sourceCodec: string | null;
}

const DEFAULT_SHORT_SIDE = 720;
const DEFAULT_BITRATE = 1_800_000;

/** WebCodecs + de API:er vi behöver för att kunna komprimera överhuvudtaget. */
export function canTranscodeVideo(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as any).VideoEncoder === 'function' &&
    typeof (window as any).VideoDecoder === 'function' &&
    typeof (window as any).VideoFrame === 'function' &&
    typeof (window as any).OffscreenCanvas === 'function'
  );
}

/**
 * Läser videospårets kodek ur containern utan att avkoda något.
 * Returnerar t.ex. "avc1.640028" (H.264) eller "hvc1.1.6.L93.B0" (HEVC).
 */
export async function probeVideoCodec(file: Blob): Promise<string | null> {
  try {
    const MP4Box: any = await import('mp4box');
    const createFile = MP4Box.createFile ?? MP4Box.default?.createFile;
    if (!createFile) return null;

    const mp4boxFile = createFile();
    let codec: string | null = null;
    mp4boxFile.onError = () => { /* ohanterbar container */ };
    mp4boxFile.onReady = (info: any) => {
      codec = info?.videoTracks?.[0]?.codec ?? null;
    };

    // iPhone lägger ibland moov-atomen sist, så hela filen måste läsas in.
    const buffer = await file.arrayBuffer();
    (buffer as any).fileStart = 0;
    mp4boxFile.appendBuffer(buffer);
    mp4boxFile.flush();
    try { mp4boxFile.stop?.(); } catch { /* ignore */ }
    return codec;
  } catch {
    return null;
  }
}

/**
 * H.264 (avc1/avc3) är den enda videokodek som spelas upp av alla webbläsare
 * på alla plattformar. HEVC fungerar på Apple men inte på Android/Windows,
 * och AV1/VP9 i MP4 saknar stöd i äldre Safari.
 */
export function isUniversallyPlayableCodec(codec: string | null): boolean {
  return !!codec && /^avc[13]/i.test(codec);
}


/* -------------------------------------------------------------------------- */
/* Posterbild                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Plockar ut en JPEG ur videons början. Använder ett vanligt <video>-element,
 * vilket fungerar i alla webbläsare som kan spela upp filen.
 */
export async function extractPosterFrame(file: Blob, maxWidth = 720): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('poster-timeout')), 12000);
      const cleanup = () => window.clearTimeout(timer);
      video.onloadeddata = () => { cleanup(); resolve(); };
      video.onerror = () => { cleanup(); reject(new Error('poster-load-error')); };
    });

    // Hoppa en aning in i klippet – första rutan är ofta svart.
    const target = Number.isFinite(video.duration) && video.duration > 0.6 ? 0.4 : 0;
    if (target > 0) {
      await new Promise<void>((resolve) => {
        const timer = window.setTimeout(resolve, 4000);
        video.onseeked = () => { window.clearTimeout(timer); resolve(); };
        video.currentTime = target;
      });
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;

    const scale = Math.min(1, maxWidth / Math.max(vw, vh));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(2, Math.round(vw * scale));
    canvas.height = Math.max(2, Math.round(vh * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.72)
    );
  } catch {
    return null;
  } finally {
    video.removeAttribute('src');
    try { video.load(); } catch { /* ignore */ }
    URL.revokeObjectURL(url);
  }
}

/* -------------------------------------------------------------------------- */
/* Hjälpare                                                                    */
/* -------------------------------------------------------------------------- */

function evenDimension(value: number): number {
  const v = Math.round(value);
  return v % 2 === 0 ? v : v + 1;
}

function targetSize(width: number, height: number, shortSide: number) {
  const short = Math.min(width, height);
  if (short <= shortSide) return { width: evenDimension(width), height: evenDimension(height) };
  const scale = shortSide / short;
  return { width: evenDimension(width * scale), height: evenDimension(height * scale) };
}

/** Rotation ur ISO BMFF-transformationsmatrisen (16.16 fixed point). */
function rotationFromMatrix(matrix?: ArrayLike<number>): 0 | 90 | 180 | 270 {
  if (!matrix || matrix.length < 5) return 0;
  const a = matrix[0] / 65536;
  const b = matrix[1] / 65536;
  if (Math.abs(a) > 0.5) return a > 0 ? 0 : 180;
  if (Math.abs(b) > 0.5) return b > 0 ? 90 : 270;
  return 0;
}

/** Hämtar avcC/hvcC-extradata som VideoDecoder behöver som `description`. */
function getVideoExtradata(mp4boxFile: any, trackId: number): Uint8Array | undefined {
  const trak = mp4boxFile.getTrackById?.(trackId);
  const entry = trak?.mdia?.minf?.stbl?.stsd?.entries?.[0];
  const box = entry?.avcC ?? entry?.hvcC ?? entry?.av1C ?? entry?.vpcC;
  if (!box) return undefined;
  const stream = new (window as any).DataStream(undefined, 0, (window as any).DataStream?.BIG_ENDIAN);
  if (!stream) return undefined;
  box.write(stream);
  return new Uint8Array(stream.buffer, 8); // hoppa över box-headern
}

/** AudioSpecificConfig ur esds – krävs för AAC-passthrough. */
function getAudioDescription(mp4boxFile: any, trackId: number): Uint8Array | undefined {
  const trak = mp4boxFile.getTrackById?.(trackId);
  const entry = trak?.mdia?.minf?.stbl?.stsd?.entries?.[0];
  const descs = entry?.esds?.esd?.descs?.[0]?.descs?.[0];
  const data = descs?.data;
  return data ? new Uint8Array(data) : undefined;
}

async function pickEncoderConfig(width: number, height: number, bitrate: number) {
  const candidates = ['avc1.42002A', 'avc1.4D002A', 'avc1.640028', 'avc1.42001F'];
  for (const codec of candidates) {
    const config: VideoEncoderConfig = {
      codec,
      width,
      height,
      bitrate,
      framerate: 30,
      ...(codec.startsWith('avc1') ? { avc: { format: 'avc' as const } } : {}),
    };
    try {
      const support = await (window as any).VideoEncoder.isConfigSupported(config);
      if (support?.supported) return config;
    } catch { /* pröva nästa */ }
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Skyddsnät: realtidsomkodning via MediaRecorder                              */
/* -------------------------------------------------------------------------- */

/** MP4/H.264 är det enda vi accepterar från skyddsnätet – se kodekregeln ovan. */
function pickRecorderMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4;codecs=avc1',
    'video/mp4',
  ];
  for (const type of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(type)) return type;
    } catch { /* pröva nästa */ }
  }
  return null;
}

/**
 * Sista utvägen när WebCodecs inte finns eller misslyckas: spela upp videon
 * dolt, rita av den till en canvas och spela in resultatet i realtid.
 *
 * Långsammare (tar lika lång tid som klippet), men den räddar exakt det fall
 * som annars blir en svart ruta: en HEVC-inspelning från en äldre iPhone.
 * Safari kan spela upp HEVC och spelar in i H.264 — så det som lämnar den
 * här funktionen går alltid att spela upp på Android och Windows.
 */
async function runRecorderTranscode(
  file: File,
  shortSide: number,
  bitrate: number,
  onProgress?: (ratio: number) => void
): Promise<Blob | null> {
  const mimeType = pickRecorderMimeType();
  if (!mimeType || typeof document === 'undefined') return null;

  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.src = url;
  video.playsInline = true;
  video.muted = true; // krävs för att få starta uppspelning utan klick
  video.preload = 'auto';

  let recorder: MediaRecorder | null = null;
  let raf = 0;

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('recorder-load-timeout')), 15000);
      video.onloadeddata = () => { window.clearTimeout(timer); resolve(); };
      video.onerror = () => { window.clearTimeout(timer); reject(new Error('recorder-load-error')); };
    });

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;
    const { width, height } = targetSize(vw, vh, shortSide);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const canvasStream = canvas.captureStream(30);

    // Ljudet tas från videoelementets egen ström. Saknas det spår helt går vi
    // hellre vidare utan skyddsnät än levererar en presentationsvideo utan röst.
    const elementStream: MediaStream | null =
      typeof (video as any).captureStream === 'function'
        ? (video as any).captureStream()
        : typeof (video as any).mozCaptureStream === 'function'
          ? (video as any).mozCaptureStream()
          : null;
    const audioTracks = elementStream?.getAudioTracks() ?? [];
    for (const track of audioTracks) canvasStream.addTrack(track);

    const chunks: Blob[] = [];
    recorder = new MediaRecorder(canvasStream, {
      mimeType,
      videoBitsPerSecond: bitrate,
      audioBitsPerSecond: 128_000,
    });
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    const finished = new Promise<void>((resolve, reject) => {
      recorder!.onstop = () => resolve();
      recorder!.onerror = () => reject(new Error('recorder-error'));
    });

    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    const draw = () => {
      ctx.drawImage(video, 0, 0, width, height);
      if (onProgress && duration > 0) onProgress(Math.min(1, video.currentTime / duration));
      raf = requestAnimationFrame(draw);
    };

    recorder.start(1000);
    await video.play();
    draw();

    await new Promise<void>((resolve) => {
      const guard = window.setTimeout(resolve, (duration || 90) * 1000 + 15000);
      video.onended = () => { window.clearTimeout(guard); resolve(); };
    });

    cancelAnimationFrame(raf);
    if (recorder.state !== 'inactive') recorder.stop();
    await finished;

    const blob = new Blob(chunks, { type: 'video/mp4' });
    return blob.size > 0 ? blob : null;
  } catch (error) {
    console.warn('[videoTranscode] skyddsnätet kunde inte köras:', error);
    return null;
  } finally {
    cancelAnimationFrame(raf);
    try { if (recorder && recorder.state !== 'inactive') recorder.stop(); } catch { /* ignore */ }
    try { video.pause(); } catch { /* ignore */ }
    video.removeAttribute('src');
    try { video.load(); } catch { /* ignore */ }
    URL.revokeObjectURL(url);
  }
}

/* -------------------------------------------------------------------------- */
/* Huvudfunktion                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Komprimerar en video till 720p H.264 i användarens enhet och tar fram en
 * posterbild.
 *
 * Tre nivåer, i tur och ordning:
 *  1. WebCodecs – snabbt, hög kvalitet, ingen kvalitetsförlust på ljudet.
 *  2. MediaRecorder – realtid, används bara om (1) inte går. Räddar HEVC.
 *  3. Originalfilen – bara om den redan är H.264 och alltså spelbar överallt.
 */
export async function optimizeVideoForUpload(
  file: File,
  options: TranscodeOptions = {}
): Promise<TranscodeResult> {
  const shortSide = options.shortSide ?? DEFAULT_SHORT_SIDE;
  const bitrate = options.videoBitrate ?? DEFAULT_BITRATE;

  let transcodedBlob: Blob | null = null;
  if (canTranscodeVideo()) {
    try {
      transcodedBlob = await runTranscode(file, shortSide, bitrate, options.onProgress);
    } catch (error) {
      console.warn('[videoTranscode] WebCodecs misslyckades:', error);
      transcodedBlob = null;
    }
  }

  // Använd bara resultatet om det faktiskt blev mindre – annars är originalet bättre.
  let useTranscoded = !!transcodedBlob && transcodedBlob.size > 0 && transcodedBlob.size < file.size;

  // Nivå 2: originalet duger inte och WebCodecs gav inget → kör skyddsnätet.
  const sourceCodec = useTranscoded ? null : await probeVideoCodec(file);
  if (!useTranscoded && !isUniversallyPlayableCodec(sourceCodec)) {
    const recovered = await runRecorderTranscode(file, shortSide, bitrate, options.onProgress);
    if (recovered && recovered.size > 0) {
      transcodedBlob = recovered;
      useTranscoded = true;
    }
  }

  const output: Blob = useTranscoded ? (transcodedBlob as Blob) : file;
  const poster = await extractPosterFrame(output).catch(() => null);

  // Egen utdata är alltid H.264 i MP4. Originalet måste kontrolleras — en
  // HEVC-inspelning från iPhone går inte att spela upp på Android/Windows.
  const playableEverywhere = useTranscoded || isUniversallyPlayableCodec(sourceCodec);

  return {
    blob: output,
    extension: useTranscoded ? 'mp4' : (file.name.split('.').pop() || 'mp4').toLowerCase(),
    poster,
    transcoded: useTranscoded,
    playableEverywhere,
    sourceCodec,
  };
}




async function runTranscode(
  file: File,
  shortSide: number,
  bitrate: number,
  onProgress?: (ratio: number) => void
): Promise<Blob> {
  const MP4Box: any = await import('mp4box');
  const createFile = MP4Box.createFile ?? MP4Box.default?.createFile;
  const DataStreamCtor = MP4Box.DataStream ?? MP4Box.default?.DataStream;
  if (!createFile) throw new Error('mp4box saknas');
  // getVideoExtradata använder DataStream via window för att slippa typberoenden.
  (window as any).DataStream = DataStreamCtor;

  const mp4boxFile = createFile();
  const buffer = await file.arrayBuffer();
  (buffer as any).fileStart = 0;

  // Demuxa hela filen i ett svep. Extraktionen måste konfigureras i onReady
  // (innan flush) – annars levererar mp4box aldrig några samples.
  const videoSamples: any[] = [];
  const audioSamples: any[] = [];

  const info: any = await new Promise((resolve, reject) => {
    let ready: any = null;
    let videoDone = false;
    let audioDone = false;
    const settle = () => {
      if (ready && videoDone && audioDone) resolve(ready);
    };

    mp4boxFile.onError = (e: unknown) => reject(new Error(String(e)));

    mp4boxFile.onReady = (parsed: any) => {
      ready = parsed;
      const vTrack = parsed.videoTracks?.[0];
      const aTrack = parsed.audioTracks?.[0];
      if (!vTrack) { reject(new Error('inget videospår')); return; }
      audioDone = !aTrack;

      mp4boxFile.onSamples = (id: number, _user: unknown, samples: any[]) => {
        if (id === vTrack.id) {
          videoSamples.push(...samples);
          if (videoSamples.length >= vTrack.nb_samples) { videoDone = true; settle(); }
        } else if (aTrack && id === aTrack.id) {
          audioSamples.push(...samples);
          if (audioSamples.length >= aTrack.nb_samples) { audioDone = true; settle(); }
        }
      };

      mp4boxFile.setExtractionOptions(vTrack.id, null, { nbSamples: 200 });
      if (aTrack) mp4boxFile.setExtractionOptions(aTrack.id, null, { nbSamples: 500 });
      mp4boxFile.start();
    };

    mp4boxFile.appendBuffer(buffer);
    mp4boxFile.flush();
    // Efter flush har mp4box levererat allt den kan – kvittera även om
    // sample-räknaren inte matchar exakt (kan skilja i trasiga filer).
    videoDone = videoDone || videoSamples.length > 0;
    audioDone = audioDone || audioSamples.length > 0;
    settle();
    window.setTimeout(() => reject(new Error('demux-timeout')), 45000);
  });

  const videoTrack = info.videoTracks?.[0];
  if (!videoTrack) throw new Error('ingen videospår');

  const audioTrack = info.audioTracks?.[0];
  const audioIsAac = !!audioTrack && /mp4a/i.test(audioTrack.codec || '');
  // Har videon ljud i ett format vi inte kan kopiera rakt av avstår vi hellre
  // än att leverera en presentationsvideo utan ljud.
  if (audioTrack && !audioIsAac) throw new Error('ljudformat stöds ej');

  const rotation = rotationFromMatrix(videoTrack.matrix ?? info.matrix);
  const swapped = rotation === 90 || rotation === 270;
  const sourceW = videoTrack.track_width || videoTrack.video?.width;
  const sourceH = videoTrack.track_height || videoTrack.video?.height;
  if (!sourceW || !sourceH) throw new Error('okända videomått');

  const displayW = swapped ? sourceH : sourceW;
  const displayH = swapped ? sourceW : sourceH;
  const { width, height } = targetSize(displayW, displayH, shortSide);

  const encoderConfig = await pickEncoderConfig(width, height, bitrate);
  if (!encoderConfig) throw new Error('ingen H.264-kodare');

  const decoderConfig: VideoDecoderConfig = {
    codec: videoTrack.codec,
    codedWidth: sourceW,
    codedHeight: sourceH,
    description: getVideoExtradata(mp4boxFile, videoTrack.id),
    hardwareAcceleration: 'no-preference',
  };
  const decoderSupport = await (window as any).VideoDecoder.isConfigSupported(decoderConfig);
  if (!decoderSupport?.supported) throw new Error('avkodning stöds ej');

  if (videoSamples.length === 0) throw new Error('inga bildrutor');

  /* --- muxer ------------------------------------------------------------ */
  const muxVideoCodec: 'avc' | 'vp9' | 'av1' = encoderConfig.codec.startsWith('vp09')
    ? 'vp9'
    : encoderConfig.codec.startsWith('av01')
      ? 'av1'
      : 'avc';
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: muxVideoCodec, width, height },
    ...(audioTrack
      ? {
          audio: {
            codec: 'aac' as const,
            numberOfChannels: audioTrack.audio?.channel_count ?? 2,
            sampleRate: audioTrack.audio?.sample_rate ?? 44100,
          },
        }
      : {}),
    fastStart: 'in-memory' as const,
    firstTimestampBehavior: 'offset' as const,
  });

  /* --- encoder ---------------------------------------------------------- */
  let encoderError: unknown = null;
  const encoder = new (window as any).VideoEncoder({
    output: (chunk: EncodedVideoChunk, meta: EncodedVideoChunkMetadata) => muxer.addVideoChunk(chunk, meta),
    error: (e: unknown) => { encoderError = e; },
  });
  encoder.configure(encoderConfig);

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas saknas');

  let processed = 0;
  const totalFrames = videoSamples.length;

  const decoder = new (window as any).VideoDecoder({
    output: (frame: VideoFrame) => {
      try {
        ctx.save();
        ctx.clearRect(0, 0, width, height);
        // Rotera enligt containerns matris (iPhone spelar in liggande + matris).
        ctx.translate(width / 2, height / 2);
        if (rotation) ctx.rotate((rotation * Math.PI) / 180);
        const drawW = swapped ? height : width;
        const drawH = swapped ? width : height;
        ctx.drawImage(frame as unknown as CanvasImageSource, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();

        const scaled = new (window as any).VideoFrame(canvas, {
          timestamp: frame.timestamp,
          duration: frame.duration ?? undefined,
        });
        // Nyckelbild ungefär varannan sekund → bra sökbarhet utan storleksstraff.
        const keyFrame = processed % 60 === 0;
        encoder.encode(scaled, { keyFrame });
        scaled.close();
      } finally {
        frame.close();
        processed += 1;
        if (onProgress && totalFrames > 0) onProgress(Math.min(1, processed / totalFrames));
      }
    },
    error: (e: unknown) => { encoderError = e; },
  });
  decoder.configure(decoderConfig);

  for (const sample of videoSamples) {
    if (encoderError) break;
    decoder.decode(
      new (window as any).EncodedVideoChunk({
        type: sample.is_sync ? 'key' : 'delta',
        timestamp: (sample.cts * 1_000_000) / sample.timescale,
        duration: (sample.duration * 1_000_000) / sample.timescale,
        data: sample.data,
      })
    );
    // Släpp referensen till råbufferten direkt – annars ligger hela filen kvar
    // i minnet parallellt med den kodade utdatan.
    sample.data = null;
    // Håll både avkodnings- och kodningskön kort så att minnet inte skenar
    // på mobil – utan detta kan hela pipelinen buffra hundratals bildrutor.
    while (!encoderError && (decoder.decodeQueueSize > 24 || encoder.encodeQueueSize > 24)) {
      await new Promise((r) => window.setTimeout(r, 8));
    }
  }



  await decoder.flush();
  decoder.close();
  await encoder.flush();
  encoder.close();
  if (encoderError) throw encoderError instanceof Error ? encoderError : new Error('kodningsfel');

  /* --- ljud: kopiera AAC rakt av (ingen kvalitetsförlust) ---------------- */
  if (audioTrack && audioSamples.length > 0) {
    const description = getAudioDescription(mp4boxFile, audioTrack.id);
    const meta = description
      ? ({ decoderConfig: { codec: 'mp4a.40.2', description } } as unknown as EncodedAudioChunkMetadata)
      : undefined;
    for (const sample of audioSamples) {
      muxer.addAudioChunkRaw(
        sample.data,
        sample.is_sync ? 'key' : 'delta',
        (sample.cts * 1_000_000) / sample.timescale,
        (sample.duration * 1_000_000) / sample.timescale,
        meta
      );
    }
  }

  muxer.finalize();
  try { mp4boxFile.stop?.(); mp4boxFile.flush?.(); } catch { /* ignore */ }

  return new Blob([target.buffer], { type: 'video/mp4' });
}
