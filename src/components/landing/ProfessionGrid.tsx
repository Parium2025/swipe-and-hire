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
import surgeon from '@/assets/professions/surgeon.jpg';
import plumber from '@/assets/professions/plumber.jpg';
import photographer from '@/assets/professions/photographer.jpg';
import painterArtist from '@/assets/professions/painter_artist.jpg';
import scientist from '@/assets/professions/scientist.jpg';
import warehouse from '@/assets/professions/warehouse.jpg';
import trucker from '@/assets/professions/trucker.jpg';
import musicianGuitar from '@/assets/professions/musician_guitar.jpg';
import pottery from '@/assets/professions/pottery.jpg';
import yoga from '@/assets/professions/yoga.jpg';
import personalTrainer from '@/assets/professions/personal_trainer.jpg';
import cashier from '@/assets/professions/cashier.jpg';
import delivery from '@/assets/professions/delivery.jpg';
import librarianPerson from '@/assets/professions/librarian_person.jpg';
import dj from '@/assets/professions/dj.jpg';
import fishermanPerson from '@/assets/professions/fisherman_person.jpg';
import gardener from '@/assets/professions/gardener.jpg';
import pilotCockpit from '@/assets/professions/pilot_cockpit.jpg';
import glassblower from '@/assets/professions/glassblower.jpg';
import solar from '@/assets/professions/solar.jpg';
import winemaker from '@/assets/professions/winemaker.jpg';
import cleaner from '@/assets/professions/cleaner.jpg';
import receptionist from '@/assets/professions/receptionist.jpg';
import pharmacist from '@/assets/professions/pharmacist.jpg';
import graphicDesigner from '@/assets/professions/graphic_designer.jpg';
import makeup from '@/assets/professions/makeup.jpg';
import waiter from '@/assets/professions/waiter.jpg';
import tattoo from '@/assets/professions/tattoo.jpg';

const professions = [
  { src: forklift, alt: 'Truckförare' },
  { src: surgeon, alt: 'Kirurg' },
  { src: programmer, alt: 'Programmerare' },
  { src: chef, alt: 'Kock' },
  { src: construction, alt: 'Byggnadsarbetare' },
  { src: hairdresser, alt: 'Frisör' },
  { src: teacher, alt: 'Lärare' },
  { src: electrician, alt: 'Elektriker' },
  { src: dentist, alt: 'Tandläkare' },
  { src: welder, alt: 'Svetsare' },
  { src: florist, alt: 'Florist' },
  { src: mechanic, alt: 'Mekaniker' },
  { src: baker, alt: 'Bagare' },
  { src: carpenter, alt: 'Snickare' },
  { src: nurse, alt: 'Sjuksköterska' },
  { src: barista, alt: 'Barista' },
  { src: architect, alt: 'Arkitekt' },
  { src: farmer, alt: 'Bonde' },
  { src: plumber, alt: 'Rörmokare' },
  { src: tailor, alt: 'Skräddare' },
  { src: photographer, alt: 'Fotograf' },
  { src: painterArtist, alt: 'Konstnär' },
  { src: scientist, alt: 'Forskare' },
  { src: warehouse, alt: 'Lagerarbetare' },
  { src: trucker, alt: 'Lastbilschaufför' },
  { src: musicianGuitar, alt: 'Musiker' },
  { src: pottery, alt: 'Keramiker' },
  { src: yoga, alt: 'Yogainstruktör' },
  { src: personalTrainer, alt: 'Personlig tränare' },
  { src: cashier, alt: 'Kassör' },
  { src: delivery, alt: 'Leveransbud' },
  { src: librarianPerson, alt: 'Bibliotekarie' },
  { src: dj, alt: 'DJ' },
  { src: fishermanPerson, alt: 'Fiskare' },
  { src: gardener, alt: 'Trädgårdsmästare' },
  { src: pilotCockpit, alt: 'Pilot' },
  { src: glassblower, alt: 'Glasblåsare' },
  { src: solar, alt: 'Solcellsmontör' },
  { src: winemaker, alt: 'Vinmakare' },
  { src: cleaner, alt: 'Städare' },
  { src: receptionist, alt: 'Receptionist' },
  { src: pharmacist, alt: 'Apotekare' },
  { src: graphicDesigner, alt: 'Grafisk designer' },
  { src: makeup, alt: 'Makeupartist' },
  { src: waiter, alt: 'Servitör' },
  { src: tattoo, alt: 'Tatuerare' },
];

const ProfessionGrid = () => {
  return (
    <div
      className="absolute inset-0 grid h-full w-full"
      style={{
        gridTemplateColumns: 'repeat(6, 1fr)',
        gridAutoRows: '1fr',
      }}
    >
      {professions.map((p, i) => (
        <div key={i} className="relative overflow-hidden">
          <img
            src={p.src}
            alt={p.alt}
            loading={i < 12 ? 'eager' : 'lazy'}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      ))}
    </div>
  );
};

export default ProfessionGrid;
