# Stabilisera databasen under nattlig belastning

## Vad som är bekräftat

Incidenten 03:24–04:40 är verklig. `cron.job_run_details` visar att minutjobben
(process-cv-queue, interview-reminders, outreach-dispatch, cleanup-expired-rate-limits)
hängde i 13–42 minuter i exakt det fönstret — trots att de bara lägger en HTTP-post i kö.
Det betyder att databasen var mättad, inte att ett enskilt jobb var långsamt.

Samtidigt är alla tunga nattjobb klumpade tätt:
03:00, 03:15 (x2), 03:20, 03:30 (x2), 03:40, 04:15 — mitt i felfönstret.

Det går inte att peka ut den exakta långsamma frågan idag: `pg_stat_statements`
är inte aktiverat i projektet.

## Föreslagna åtgärder

1. **Aktivera `pg_stat_statements`** så att långsamma satser kan mätas i stället för gissas.
2. **Sprid ut nattjobben** så att inte fyra tunga jobb överlappar:
   - purge-deleted-jobs 03:15, purge-outreach-logs 03:35, prune-cron-run-details 03:50,
     data-retention 04:10, purge-completed-deletion-rows 04:25,
     saved-searches-full-scan 04:45, inactive-account-retention 05:10.
3. **Minutjobben görs självskyddande:** hoppa över körning om föregående körning
   fortfarande pågår (advisory lock i `job_run_locks` finns redan i schemat och kan användas).
4. **Efter en natt med mätdata:** lägg index / paginering på de tre dyraste satserna,
   eller höj instansstorleken om belastningen är legitim.

## Varför detta inte gjordes direkt

Steg 2–4 ändrar schemalagd drift och kan påverka retention och utskick.
De bör godkännas innan de körs.
