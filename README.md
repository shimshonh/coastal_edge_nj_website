# Coastal Edge website

Static site for coastaledgenj.com with two small server functions (lead emails and the AI assistant).

## What is here

| Path | What it is |
| --- | --- |
| `sitedata.py` | All content: unit status, listed prices, floor plans, amenities, FAQ, contact details |
| `src/templates/` | Page layouts |
| `src/static/` | Styles, script, photos, floor plan images, PDFs, fonts |
| `build.py` | Builds the site into `dist/` and writes `lib/facts.json` for the assistant |
| `api/lead.js` | Receives every form and emails it to the sales inbox |
| `api/chat.js` | The AI assistant. Answers only from `lib/facts.json` |
| `tools/` | Photo and floor plan preparation, local preview server, function tests |
| `vercel.json` | Hosting settings, including redirects from the old WordPress PDF links |

## Updating availability or prices

1. Open `sitedata.py`.
2. Change the letters in `_STATUS` (A = available, U = under contract, S = sold). Each row is a floor, each letter is a unit in order (x01, x02, ...).
3. A price shows only for units listed in `PUBLIC_PRICES`. Add a unit there only when it is publicly listed. Everything else shows "Request pricing". Never put internal prices in this file, because everything in it is published.
4. The sold counter ("13 of 36 residences sold") counts the letters in `_STATUS`, so it updates by itself.
5. "Just listed" and "Recently sold" tags come from `UNIT_TAGS`. Add a unit when it is listed or closes, and take it out after a month or so.
6. Change the `updated` date near the top of the file.
7. Run `python3 build.py` and deploy.

## Preview on your computer

```
python3 build.py
python3 tools/serve.py 8080
```

Then open http://127.0.0.1:8080. In this preview the forms answer "thank you" without sending anything and the assistant is off.

## Going live (Vercel)

1. Import the repository in Vercel. No framework. The settings in `vercel.json` do the rest.
2. Add these environment variables in Vercel:
   - `ANTHROPIC_API_KEY`: key for the AI assistant (console.anthropic.com).
   - `RESEND_API_KEY`: key for sending lead emails (resend.com). Verify the coastaledgenj.com domain in Resend so mail can be sent from `leads@coastaledgenj.com`.
   - Optional: `LEAD_TO` (default `info@coastaledgenj.com`, comma separated for more than one), `LEAD_FROM`, `CHAT_MODEL`.
3. Add the domain coastaledgenj.com in Vercel and point the DNS records where Vercel says.

## Spam and bot filtering

Every form and the assistant go through the checks in `lib/lead.js`. No outside service or account is needed.

- Dropped without an email: a hidden field only bots fill in, and anything not sent by the site's own script.
- Sent back to the visitor to fix: no name, a made up or throwaway email address, an email domain that cannot receive mail (unless a real phone number was given).
- Emailed with `[Possible spam]` at the start of the subject: sent within 3 seconds of opening the page, sent from outside the website, links or sales pitch wording in the message, a name that is not a name, a phone number that cannot be real. Make a mail filter on that subject to keep these out of the main inbox.
- Each visitor is limited to 8 forms and 30 assistant questions per 10 minutes. The assistant only answers requests that come from the chat box on this website.

The sales phone number is set once, in `sitedata.py` (`phone_display` and `phone_tel`). It shows in the footer, on the contact page, in the phone menu and in the FAQ, and the assistant gives it when asked.

## Checks

`node tools/test-api.js` runs the lead and assistant functions against stand-ins. Nothing is sent.

## Before launch

- Replace the MLS watermarked photos in `src/static/img/photos/` with the photographer's originals (same file names), or rerun `tools/images.py` on them.
- Confirm the tax abatement wording in the FAQ, and the legal line in the footer.
