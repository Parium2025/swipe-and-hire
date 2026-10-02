/**
 * Företagets standard-möteslänk — medvetet avstängd.
 *
 * Varje person måste själv skapa och klistra in sin egen möteslänk
 * (t.ex. från Google Meet). En gemensam länk får aldrig föreslås eller
 * fyllas i automatiskt, annars hamnar flera rekryterares intervjuer
 * i samma mötesrum samtidigt.
 *
 * Hooken behålls så att anropande vyer fungerar oförändrat, men
 * returnerar alltid tom sträng.
 */
export const useOrgDefaultVideoLink = (): string => '';
