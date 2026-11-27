# Setup

- In .env set DWB_API_URL=https://testdrive.donordrive.com/api
- In controls set fundraising event to https://events.doctorswithoutborders.org/participants/4715

## Testing donation messages

- in .env set OPENAI_API_KEY
- In DonationMessages component enable the commented out lines
- Set the messages of donations

## Testing RTD

- In connections set the jf relay websocket plugin token, and enable fundraising RTD
- RTD runs from the controls page, so keep it open
- Enable the commented out lines in src/lib/fundraising-rtd.ts
- Set a donation's amount to at least 20 and the message to 'rtd snail' for example
