import forklift from '@/assets/professions/forklift.jpg';
import dentist from '@/assets/professions/dentist.jpg';
import programmer from '@/assets/professions/programmer.jpg';
import chef from '@/assets/professions/chef.jpg';
import nurse from '@/assets/professions/nurse.jpg';
import mechanic from '@/assets/professions/mechanic.jpg';
import teacher from '@/assets/professions/teacher.jpg';
import electrician from '@/assets/professions/electrician.jpg';
import architect from '@/assets/professions/architect.jpg';
import hairdresser from '@/assets/professions/hairdresser.jpg';
import welder from '@/assets/professions/welder.jpg';
import carpenter from '@/assets/professions/carpenter.jpg';
import baker from '@/assets/professions/baker.jpg';
import farmer from '@/assets/professions/farmer.jpg';
import florist from '@/assets/professions/florist.jpg';
import barista from '@/assets/professions/barista.jpg';
import construction from '@/assets/professions/construction.jpg';
import tailor from '@/assets/professions/tailor.jpg';
import photographer from '@/assets/professions/photographer.jpg';
import painter from '@/assets/professions/painter.jpg';
import scientist from '@/assets/professions/scientist.jpg';
import warehouse from '@/assets/professions/warehouse.jpg';
import trucker from '@/assets/professions/trucker.jpg';
import musician from '@/assets/professions/musician.jpg';
import pottery from '@/assets/professions/pottery.jpg';

const professions = [
  { src: forklift, alt: 'Truckförare' },
  { src: dentist, alt: 'Tandläkare' },
  { src: programmer, alt: 'Programmerare' },
  { src: chef, alt: 'Kock' },
  { src: nurse, alt: 'Sjuksköterska' },
  { src: mechanic, alt: 'Mekaniker' },
  { src: teacher, alt: 'Lärare' },
  { src: electrician, alt: 'Elektriker' },
  { src: architect, alt: 'Arkitekt' },
  { src: hairdresser, alt: 'Frisör' },
  { src: welder, alt: 'Svetsare' },
  { src: carpenter, alt: 'Snickare' },
  { src: baker, alt: 'Bagare' },
  { src: farmer, alt: 'Bonde' },
  { src: florist, alt: 'Florist' },
  { src: barista, alt: 'Barista' },
  { src: construction, alt: 'Byggnadsarbetare' },
  { src: tailor, alt: 'Skräddare' },
  { src: photographer, alt: 'Fotograf' },
  { src: painter, alt: 'Konstnär' },
  { src: scientist, alt: 'Forskare' },
  { src: warehouse, alt: 'Lagerarbetare' },
  { src: trucker, alt: 'Lastbilschaufför' },
  { src: musician, alt: 'Musiker' },
  { src: pottery, alt: 'Keramiker' },
];

const ProfessionGrid = () => {
  return (
    <div className="absolute inset-0 grid grid-cols-5 grid-rows-5 h-full w-full">
      {professions.map((p, i) => (
        <div key={i} className="relative overflow-hidden">
          <img
            src={p.src}
            alt={p.alt}
            loading={i < 10 ? 'eager' : 'lazy'}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      ))}
    </div>
  );
};

export default ProfessionGrid;
