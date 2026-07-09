import { OCCUPATION_CATEGORIES } from '../src/lib/occupations';
import { categorizeJob } from '../src/lib/jobCategorization';

function run(label: string, useOccupation: boolean) {
  let total=0, correct=0, wrong=0, empty=0;
  const failures: string[] = [];
  for (const cat of OCCUPATION_CATEGORIES) {
    for (const sub of cat.subcategories || []) {
      total++;
      const result = categorizeJob(sub, `Vi söker en ${sub}.`, useOccupation ? sub : '');
      if (!result) { empty++; failures.push(`  TOM: "${sub}" (borde: ${cat.value})`); }
      else if (result === cat.value) correct++;
      else { wrong++; failures.push(`  FEL: "${sub}" → ${result} (borde: ${cat.value})`); }
    }
  }
  console.log(`\n=== ${label} ===`);
  console.log(`Totalt ${total} | Rätt ${correct} (${(correct/total*100).toFixed(1)}%) | Fel ${wrong} | Tom ${empty}`);
  failures.slice(0,50).forEach(f => console.log(f));
  if (failures.length > 50) console.log(`  ... +${failures.length-50} till`);
}

run('MED occupation-fält (som wizarden alltid sätter)', true);
run('UTAN occupation-fält (endast titel + beskrivning)', false);
