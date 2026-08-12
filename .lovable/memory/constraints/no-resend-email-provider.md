---
name: Ingen Resend – Lovable Emails gäller
description: Projektet använder Lovables inbyggda app-mejl, inte Resend eller annan extern e-postleverantör.
type: constraint
---

Resend (och andra externa e-postleverantörer) ska inte användas eller föreslås i detta projekt.
All e-post går via Lovables inbyggda app-mejl-infrastruktur (`send-transactional-email`).

**Why:** Användaren har uttryckligen valt bort Resend och kör Lovables egna mejl.

**How to apply:** Föreslå aldrig Resend/SendGrid. "Resend confirmation"-funktioner i koden syftar på
att skicka bekräftelsemejl igen — inte på leverantören Resend.
