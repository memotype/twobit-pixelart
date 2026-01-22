# privacy.template.md

## Parameters

APP_NAME: "Settle"
CONTACT_EMAIL: `twobitsprite@gmail.com`

USES_CAMERA: false
USES_MICROPHONE: false
USES_LOCATION: false

STORES_LOCAL_PREFERENCES: true
STORES_USER_CONTENT: false

USES_NETWORK: false
USES_THIRD_PARTY_SDKS: false
USES_ANALYTICS: false
USES_ADVERTISING: false

---

## Instructions

Using the "Template" section of privacy.template.md as the canonical
source, generate:

1. PRIVACY.md (Markdown)
2. privacy.html (static HTML)

Apply the parameter values at the top of the template.
Omit any conditional sections that evaluate to false.
Do not add new clauses or legal language.
Preserve tone and meaning exactly.

For HTML:
- Wrap paragraphs in `<p>`
- Use a minimal `<main>` container
- No scripts
- No tracking
- No cookie banners

This file is the sole source of truth for privacy policy generation.
Do not infer, add, or remove clauses beyond what is defined here.

---

## Template

```markdown
<!--
This file is generated from privacy.template.md.
Do not edit manually.
-->

# Privacy Policy

{{APP_NAME}} does not collect, store, or transmit any personal or identifying
data.

## Data Collection

{{#if USES_CAMERA}}
This app uses the device camera only for on-device functionality. Images are
processed locally and are not saved, uploaded, or shared.
{{/if}}

{{#if USES_MICROPHONE}}
This app uses the device microphone only for on-device functionality. Audio is
processed locally and is not saved, uploaded, or shared.
{{/if}}

{{#if USES_LOCATION}}
This app accesses location data only for on-device functionality. Location data
is not transmitted or stored.
{{/if}}

{{#if STORES_LOCAL_PREFERENCES}}
This app stores limited, non-personal configuration data locally on the device
(such as user preferences or settings). This data never leaves the device and is
not accessible to the developer.
{{/if}}

{{#if STORES_USER_CONTENT}}
User-created content is stored locally on the device. This data is not uploaded
or shared.
{{/if}}

## Tracking and Analytics

{{#if USES_ANALYTICS}}
This app uses analytics to understand aggregate usage patterns. No personal or
identifying data is collected.
{{/if}}

{{#unless USES_ANALYTICS}}
This app does not use analytics, tracking technologies, or behavioral profiling.
{{/unless}}

{{#if USES_ADVERTISING}}
This app uses advertising services which may collect limited data as described
by their respective privacy policies.
{{/if}}

{{#unless USES_ADVERTISING}}
This app does not use advertising services.
{{/unless}}

{{#if USES_THIRD_PARTY_SDKS}}
This app includes third-party SDKs that may process data as described in their
documentation.
{{/if}}

{{#unless USES_THIRD_PARTY_SDKS}}
This app does not include third-party SDKs that collect or transmit data.
{{/unless}}

## Network Access

{{#if USES_NETWORK}}
This app may access the network to provide core functionality.
{{/if}}

{{#unless USES_NETWORK}}
This app does not transmit data over the network.
{{/unless}}

## Contact

If you have questions about this policy, contact:
{{CONTACT_EMAIL}}
```
