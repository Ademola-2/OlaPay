# OlaPay

OlaPay is a mobile-first VTU and bills-payment website concept being built with HTML, CSS, JavaScript, Bootstrap 5, and Firebase.

## Current status

- Responsive landing page and service overview
- Mobile navigation
- Interactive preview-only wallet button
- No real authentication, wallet, payment, or VTU transactions are enabled yet

## Project structure

- `index.html` — landing page
- `css/style.css` — site styling and responsive layout
- `js/app.js` — small frontend interactions

## Preview locally

Open `index.html` in a browser, or serve the folder using a static web server.

## Planned next stages

1. Confirm brand name and visual identity.
2. Configure Firebase Authentication and Firestore.
3. Add secure Cloud Functions and Firestore Security Rules.
4. Implement customer account and dashboard.
5. Integrate a payment gateway and a VTU service provider.
6. Add admin tools, monitoring, and transaction reconciliation.

## Security note

Never place Firebase Admin SDK credentials, payment secret keys, or VTU provider secrets in frontend files. Real wallet balances and payment statuses must be controlled and verified by trusted backend code.