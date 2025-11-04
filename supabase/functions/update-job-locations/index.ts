import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { parse } from 'https://deno.land/std@0.224.0/csv/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PostalCodeInfo {
  postalCode: string;
  city: string;
  municipality: string;
  county: string;
}

let postalCodeCache: Map<string, PostalCodeInfo> | null = null;

async function loadPostalCodes(): Promise<Map<string, PostalCodeInfo>> {
  if (postalCodeCache) {
    return postalCodeCache;
  }

  try {
    // Try to load from project's public folder first
    let response = await fetch('https://rvtsfnaqlnggfkoqygbm.supabase.co/swedish-postal-codes.csv');
    
    // If that fails, try the direct path
    if (!response.ok) {
      const file = await Deno.readTextFile('./public/swedish-postal-codes.csv');
      const records = parse(file, { skipFirstRow: true });
      
      postalCodeCache = new Map();
      
      for (const record of records) {
        const [postalCode, city, municipality, county] = record as string[];
        if (postalCode && city) {
          postalCodeCache.set(postalCode.replace(/\s/g, ''), {
            postalCode: postalCode.trim(),
            city: city.trim(),
            municipality: municipality?.trim() || city.trim(),
            county: county?.trim() || '',
          });
        }
      }
      
      console.log(`Loaded ${postalCodeCache.size} postal codes from file`);
      return postalCodeCache;
    }

    const csvText = await response.text();
    const records = parse(csvText, { skipFirstRow: true });

    postalCodeCache = new Map();

    for (const record of records) {
      const [postalCode, city, municipality, county] = record as string[];
      if (postalCode && city) {
        postalCodeCache.set(postalCode.replace(/\s/g, ''), {
          postalCode: postalCode.trim(),
          city: city.trim(),
          municipality: municipality?.trim() || city.trim(),
          county: county?.trim() || '',
        });
      }
    }

    console.log(`Loaded ${postalCodeCache.size} postal codes from CSV`);
    return postalCodeCache;
  } catch (error) {
    console.error('Error loading postal codes:', error);
    postalCodeCache = new Map();
    return postalCodeCache;
  }
}

async function getLocationFromPostalCode(postalCode: string): Promise<PostalCodeInfo | null> {
  if (!postalCode) return null;
  
  const cleanCode = postalCode.replace(/\s/g, '');
  const cache = await loadPostalCodes();
  
  return cache.get(cleanCode) || null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // Fetch all jobs with postal codes but missing county/municipality
    const { data: jobs, error: fetchError } = await supabaseClient
      .from('job_postings')
      .select('id, workplace_postal_code, workplace_county, workplace_municipality')
      .not('workplace_postal_code', 'is', null)
      .or('workplace_county.is.null,workplace_municipality.is.null');

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Found ${jobs?.length || 0} jobs to update`);

    let updated = 0;
    let skipped = 0;
    let failed = 0;

    // Update jobs in batches
    for (const job of jobs || []) {
      if (!job.workplace_postal_code) {
        skipped++;
        continue;
      }

      const locationInfo = await getLocationFromPostalCode(job.workplace_postal_code);
      
      if (!locationInfo) {
        console.log(`No location info found for postal code: ${job.workplace_postal_code}`);
        skipped++;
        continue;
      }

      // Only update if both fields are missing
      if (!job.workplace_county || !job.workplace_municipality) {
        const { error: updateError } = await supabaseClient
          .from('job_postings')
          .update({
            workplace_county: locationInfo.county,
            workplace_municipality: locationInfo.municipality,
          })
          .eq('id', job.id);

        if (updateError) {
          console.error(`Failed to update job ${job.id}:`, updateError);
          failed++;
        } else {
          updated++;
        }
      } else {
        skipped++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Updated ${updated} jobs, skipped ${skipped}, failed ${failed}`,
        stats: { updated, skipped, failed, total: jobs?.length || 0 },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
