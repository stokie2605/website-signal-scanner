# Case Study: Local Charity Website Accessibility & UX Audit

This case study documents a conceptual first-pass optimization audit performed using the **Website Signal Scanner** for a community foodbank portal. It models the workflow of a digital operations developer identifying accessibility barriers, mobile responsiveness issues, and local search signals.

---

## 🏢 Audit Target Profile
* **Organization:** Community Foodbank Concept
* **Page Audited:** Public Homepage
* **Focus Areas:** Mobile responsiveness, aria-navigable structure, local SEO relevance, and loading performance.

---

## ⚠️ Key Findings & Signals Captured

### 1. Mobile Usability (Score: 58/100)
* **Signal:** The scanner detected key content and tables (such as donation drop-off schedules) extending beyond the viewport boundary, causing horizontal overflow.
* **Impact:** Mobile visitors had to scroll sideways to read timing details, leading to high friction for donors trying to find open hours on their phones.

### 2. Accessibility Signals (Score: 62/100)
* **Signal:** Image visual banners lacked alternative (`alt`) text tags, and the contact button was represented by an unlabelled icon.
* **Impact:** Screen readers could not describe the main visual banner or announce the destination of the contact route, blocking visually impaired users from initiating inquiries.

### 3. Local SEO Optimization (Score: 55/100)
* **Signal:** The page title was set to a generic "Home" value, and heading tags skipped from `<h1>` directly to `<h3>`.
* **Impact:** Search engines could not index local location relevance signals (e.g., "Foodbank in Alsager, Cheshire"), reducing visibility in regional search queries.

---

## 🛠️ Recommended Action Plan

The scanner generated the following prioritized list of fixes:

1. **Fix Viewport Overflow:** Wrap data tables in a horizontally scrollable container or convert them to responsive stacked lists on viewports under 640px.
2. **Add Accessible Labels:** Add descriptive `alt` text to all image tags and include `aria-label="Contact Support via Phone"` to icon-only links.
3. **Restructure Heading Hierarchy:** Update page headers to follow a logical `h1 -> h2 -> h3` sequence for better search engine readability.
4. **Localize Metadata:** Change the document title to `Alsager Community Foodbank | Emergency Food Support & Donations` and ensure key location keywords appear within the introductory paragraph.

---

## 📈 Audit Verification & Outcome

By implementing these responsive styling adjustments and semantic tag corrections:
* **Mobile Score:** Rebounded to **92/100** by resolving table overflow.
* **Accessibility Score:** Rebounded to **95/100** after adding complete screen-reader labels and checking contrast ratios.
* **Local SEO Rank:** Regional search index scans showed immediate recognition of location target phrases.
