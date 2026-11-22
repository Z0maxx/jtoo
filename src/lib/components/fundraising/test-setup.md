# Setup
- In .ENV set DWB_API_URL=https://testdrive.donordrive.com/api
- In controls set fundraising event to https://events.doctorswithoutborders.org/participants/4715

## Testing donations
- In FundraisingSection component enable the commented out lines at the top

## Testing donation messages
- Same steps as in Testing donations
- In DonationMessages component comment out the filter that checks if donation has message and enable one of the commented out messages in the template

## Testing progress bar and animations
- In Overview component enable the commented out lines at the top and switch the while loop to the commented out one
- If you want to speed it up, check the other commented out lines and change the --restore-animation-after css variable in FundraisingSection component

## Testing milestones
- Enable the commented out test milestones in Milestones component

## Testing RTD
- Same steps as in Testing donations
- In connections set the jf relay websocket plugin token
- If you want to test specific RTD effects, set a donation's amount to at least 30 and the message to 'rtd snail' for example