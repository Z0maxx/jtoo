# Setup

- In .env set DWB_API_URL=https://testdrive.donordrive.com/api
- In controls set fundraising event to https://events.doctorswithoutborders.org/participants/4715

## Testing donations

- In Donations component enable the commented out lines at the top

## Testing donation messages

- in .env set OPENAI_API_KEY
- In DonationMessages component enable the commented out lines
- Set the messages of donations

## Testing progress bar and animations

- In Overview component enable the commented out lines at the top and switch the while loop to the commented out one
- If you want to speed it up, check the other commented out lines and change the --restore-animation-after css variable in FundraisingSection component

## Testing milestones

- Enable the commented out test milestones in Milestones component

## Testing RTD

- In connections set the jf relay websocket plugin token
- Enable the commented out lines in Rtd component
- Set a donation's amount to at least 20 and the message to 'rtd snail' for example
