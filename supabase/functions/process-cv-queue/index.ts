import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 5; // Process 5 CVs at a time
const DELAY_BETWEEN_BATCHES_MS = 2000; // 2 seconds between batches to avoid rate limits

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('Starting CV queue processing...');
    
    // Get next batch of CVs to process
    const { data: batch, error: batchError } = await supabase
      .rpc('get_cv_queue_batch', { p_batch_size: BATCH_SIZE });
    
    if (batchError) {
      console.error('Error getting batch:', batchError);
      throw batchError;
    }
    
    if (!batch || batch.length === 0) {
      console.log('No CVs in queue to process');
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: 'Queue empty' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Processing ${batch.length} CVs from queue`);
    
    const results = [];
    
    for (const item of batch) {
      try {
        console.log(`Processing queue item ${item.id} for applicant ${item.applicant_id}`);
        
        // Call the existing generate-cv-summary function
        const { data: summaryResult, error: summaryError } = await supabase.functions.invoke(
          'generate-cv-summary',
          {
            body: {
              applicant_id: item.applicant_id,
              application_id: item.application_id,
              job_id: item.job_id,
              cv_url_override: item.cv_url,
            },
          }
        );
        
        if (summaryError) {
          console.error(`Error generating summary for ${item.id}:`, summaryError);
          await supabase.rpc('complete_cv_analysis', {
            p_queue_id: item.id,
            p_success: false,
            p_error_message: summaryError.message || 'Unknown error',
          });
          results.push({ id: item.id, success: false, error: summaryError.message });
        } else {
          console.log(`Successfully processed ${item.id}`);
          await supabase.rpc('complete_cv_analysis', {
            p_queue_id: item.id,
            p_success: true,
          });
          results.push({ id: item.id, success: true });
        }
        
        // Small delay between items to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (itemError) {
        console.error(`Error processing item ${item.id}:`, itemError);
        await supabase.rpc('complete_cv_analysis', {
          p_queue_id: item.id,
          p_success: false,
          p_error_message: itemError instanceof Error ? itemError.message : 'Unknown error',
        });
        results.push({ id: item.id, success: false, error: String(itemError) });
      }
    }
    
    // Check if there are more items in queue
    const { count } = await supabase
      .from('cv_analysis_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    
    console.log(`Processed ${batch.length} CVs. ${count || 0} remaining in queue.`);
    
    return new Response(
      JSON.stringify({
        success: true,
        processed: batch.length,
        results,
        remaining: count || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Queue processing error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
