import forklift from '@/assets/professions/forklift.jpg';
import dentist from '@/assets/professions/dentist.jpg';
import programmer from '@/assets/professions/programmer.jpg';
import chef from '@/assets/professions/chef.jpg';
import nurse from '@/assets/professions/nurse.jpg';
import mechanic from '@/assets/professions/mechanic.jpg';
import teacher from '@/assets/professions/teacher.jpg';
import electrician from '@/assets/professions/electrician.jpg';
import hairdresser from '@/assets/professions/hairdresser.jpg';
import welder from '@/assets/professions/welder.jpg';
import carpenter from '@/assets/professions/carpenter.jpg';
import baker from '@/assets/professions/baker.jpg';
import farmer from '@/assets/professions/farmer.jpg';
import florist from '@/assets/professions/florist.jpg';
import barista from '@/assets/professions/barista.jpg';
import construction from '@/assets/professions/construction.jpg';
import photographer from '@/assets/professions/photographer.jpg';

const professions = [
  { src: welder, alt: 'Svetsare' },
  { src: chef, alt: 'Kock' },
  { src: programmer, alt: 'Programmerare' },
  { src: nurse, alt: 'Sjuksköterska' },
  { src: construction, alt: 'Byggnadsarbetare' },
  { src: hairdresser, alt: 'Frisör' },
  { src: electrician, alt: 'Elektriker' },
  { src: barista, alt: 'Barista' },
  { src: forklift, alt: 'Truckförare' },
  { src: teacher, alt: 'Lärare' },
  { src: mechanic, alt: 'Mekaniker' },
  { src: florist, alt: 'Florist' },
  { src: carpenter, alt: 'Snickare' },
  { src: dentist, alt: 'Tandläkare' },
  { src: farmer, alt: 'Bonde' },
  { src: baker, alt: 'Bagare' },
  { src: photographer, alt: 'Fotograf' },
  // Repeat a few to fill 18 cells (3 rows × 6 cols) — pick the most visually distinct
];

const ProfessionGrid = () => {
  // 18 images in a 6×3 grid fills the screen perfectly
  const gridItems = professions.length < 18
    ? [...professions, professions[0]] // pad to 18 if needed
    : professions.slice(0, 18);

  return (
    <div
      className="absolute inset-0 grid h-full w-full"
      style={{
        gridTemplateColumns: 'repeat(6, 1fr)',
        gridTemplateRows: 'repeat(3, 1fr)',
      }}
    >
      {gridItems.map((p, i) => (
        <div key={i} className="relative overflow-hidden">
          <img
            src={p.src}
            alt={p.alt}
            loading={i < 6 ? 'eager' : 'lazy'}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      ))}
    </div>
  );
};

export default ProfessionGrid;
