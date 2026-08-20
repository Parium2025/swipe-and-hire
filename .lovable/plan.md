# Förenkla mallbiblioteket och testflödet

## Det här ändras
- Ta bort **Kom igång snabbt** helt; flödet är nu tillräckligt enkelt utan att skapa många mallar och regler på en gång.
- Göra **Skicka nu** begriplig: knappen ska bara vara aktiv när det faktiskt finns väntande utskick och texten ska tydligt förklara att den tömmer kön, inte skapar ett testutskick.
- Lägga till markeringsläge i Mallbiblioteket med **Markera alla**, val per mall och säker massradering med bekräftelse.
- Lägga till **Återställ Parium-standard** per relevant mall. Det återställer bara vald mall/kanal till Pariums originaltext och påverkar inte övriga mallar eller regler.
- Om en Parium-standardmall har tagits bort ska den kunna läggas tillbaka individuellt, utan att alla andra standardmallar skapas.

## Säkerhet och beteende
- Destruktiva åtgärder bekräftas i dialog.
- Mallar som används av aktiva regler hanteras tydligt; inga andra mallar eller regler ändras av misstag.
- Befintlig design, responsivitet och scrollbeteende behålls.

## Teknisk lösning
- Utöka befintlig mallvy och återanvänd `DEFAULT_OUTREACH_TEMPLATES` som enda källa för originalinnehåll.
- Utföra bulk-delete med en enda ägarbegränsad databasoperation genom befintliga åtkomstregler.
- Uppdatera eller skapa exakt en standardmall vid återställning och sedan synkronisera studions cache/state.
