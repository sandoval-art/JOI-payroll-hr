# Modern Trustee Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the "Modern Trustee" Stitch design system (Navy + Orange, Manrope font, editorial no-border aesthetic) to the Joi Payroll React app.

**Architecture:** Swap CSS custom properties in `index.css` to match the Stitch color tokens. Import Manrope from Google Fonts. Update shadcn base components (Card, Button, Input) to enforce the editorial no-border, tonal-layering philosophy. Polish page-level components to remove hardcoded colors and borders.

**Tech Stack:** React, Tailwind CSS, shadcn/ui (CVA), Google Fonts

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `index.html` | Add Manrope Google Font link, update title/meta |
| Modify | `src/index.css` | Replace all CSS custom properties with Modern Trustee tokens |
| Modify | `tailwind.config.ts` | Add Manrope font family, update radius default |
| Modify | `src/components/ui/button.tsx` | Update roundedness to xl, editorial variant styles |
| Modify | `src/components/ui/card.tsx` | Remove border, apply tonal layering |
| Modify | `src/components/ui/input.tsx` | Bottom-border focus style, surface-container-low bg |
| Modify | `src/components/AppLayout.tsx` | Frosted glass header, remove header border |
| Modify | `src/components/AppSidebar.tsx` | Navy sidebar with orange active accents |
| Modify | `src/pages/Dashboard.tsx` | Trustee Header, remove hardcoded borders/colors |
| Modify | `src/pages/Auth.tsx` | Apply editorial card styling to login |

---

### Task 1: Google Fonts & HTML Meta

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add Manrope font and update meta**

Replace the contents of `<head>` in `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>JOI Payroll & HR</title>
    <meta name="description" content="JOI Payroll & HR Management System" />
    <meta name="author" content="JOI" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Verify font loads**

Run: `npm run dev`
Open browser DevTools → Network tab → confirm `Manrope` font files load.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add Manrope font and update HTML meta for Modern Trustee"
```

---

### Task 2: CSS Custom Properties (The Core Theme Swap)

**Files:**
- Modify: `src/index.css`

This is the single most impactful change. All shadcn components read from these variables.

**Color mapping from Stitch "Modern Trustee" design MD:**

| Token | Hex | HSL (approx) | Purpose |
|-------|-----|---------------|---------|
| surface | #f8f9fa | 210 17% 98% | Background |
| surface-container-lowest | #ffffff | 0 0% 100% | Card bg |
| surface-container-low | #f3f4f5 | 210 10% 96% | Muted/input bg |
| surface-container | #edeeef | 210 7% 93% | Container |
| surface-container-high | #e7e8e9 | 210 5% 91% | Hover states |
| on-surface | #0f1c2c | 213 49% 12% | Foreground (never pure black) |
| on-surface-variant | #44474c | 220 5% 28% | Muted text |
| primary | #FFA700 | 39 100% 50% | Orange CTA |
| primary-container | #845400 | 38 100% 26% | Deep orange |
| on-primary | #ffffff | 0 0% 100% | Text on primary |
| secondary-container | #fc7728 | 20 97% 57% | Vibrant accent |
| outline-variant | #c4c6cc | 220 8% 78% | Ghost border (at 15% opacity) |
| sidebar-bg (primary_container) | #0f1c2c | 213 49% 12% | Dark navy |
| sidebar-fg | #d6e4f9 | 216 72% 91% | Sidebar text |
| sidebar-primary | #FFA700 | 39 100% 50% | Active sidebar icon |
| sidebar-accent | #1a2a3d | 213 40% 17% | Sidebar hover |

- [ ] **Step 1: Replace all CSS variables in index.css**

Replace the entire contents of `src/index.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Modern Trustee — Light Mode */
    --background: 210 17% 98%;
    --foreground: 213 49% 12%;

    --card: 0 0% 100%;
    --card-foreground: 213 49% 12%;

    --popover: 0 0% 100%;
    --popover-foreground: 213 49% 12%;

    --primary: 39 100% 50%;
    --primary-foreground: 0 0% 100%;

    --secondary: 210 10% 96%;
    --secondary-foreground: 213 49% 12%;

    --muted: 210 10% 96%;
    --muted-foreground: 220 5% 28%;

    --accent: 20 97% 57%;
    --accent-foreground: 0 0% 100%;

    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;

    --border: 220 8% 78% / 0.15;
    --input: 210 10% 96%;
    --ring: 39 100% 50%;

    --radius: 0.5rem;

    /* Sidebar — Deep Navy */
    --sidebar-background: 213 49% 12%;
    --sidebar-foreground: 216 72% 91%;
    --sidebar-primary: 39 100% 50%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 213 40% 17%;
    --sidebar-accent-foreground: 216 72% 91%;
    --sidebar-border: 213 40% 17% / 0.15;
    --sidebar-ring: 39 100% 50%;
  }

  .dark {
    /* Modern Trustee — Dark Mode (Navy-based) */
    --background: 213 49% 7%;
    --foreground: 216 72% 91%;

    --card: 213 49% 10%;
    --card-foreground: 216 72% 91%;

    --popover: 213 49% 10%;
    --popover-foreground: 216 72% 91%;

    --primary: 39 100% 50%;
    --primary-foreground: 213 49% 7%;

    --secondary: 213 40% 17%;
    --secondary-foreground: 216 72% 91%;

    --muted: 213 40% 17%;
    --muted-foreground: 220 8% 60%;

    --accent: 20 97% 57%;
    --accent-foreground: 0 0% 100%;

    --destructive: 0 63% 31%;
    --destructive-foreground: 0 0% 100%;

    --border: 220 8% 78% / 0.10;
    --input: 213 40% 17%;
    --ring: 39 100% 50%;

    --sidebar-background: 213 49% 5%;
    --sidebar-foreground: 216 72% 91%;
    --sidebar-primary: 39 100% 50%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 213 40% 12%;
    --sidebar-accent-foreground: 216 72% 91%;
    --sidebar-border: 213 40% 12% / 0.15;
    --sidebar-ring: 39 100% 50%;
  }
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
    font-family: 'Manrope', sans-serif;
  }
}
```

- [ ] **Step 2: Verify in browser**

Run: `npm run dev`
Confirm: background is light #f8f9fa, text is navy #0f1c2c, sidebar is dark navy, primary buttons are orange.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat: replace CSS variables with Modern Trustee design tokens"
```

---

### Task 3: Tailwind Config — Font Family & Radius

**Files:**
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Add Manrope font family to tailwind config**

In `tailwind.config.ts`, add `fontFamily` inside the `extend` block, right after the opening of `extend`:

```typescript
fontFamily: {
  sans: ['Manrope', 'system-ui', 'sans-serif'],
},
```

The full `extend` block should start with:

```typescript
extend: {
  fontFamily: {
    sans: ['Manrope', 'system-ui', 'sans-serif'],
  },
  colors: {
    // ... existing color definitions unchanged
```

- [ ] **Step 2: Verify font applies globally**

Run: `npm run dev`
Open DevTools → Computed styles on any text → confirm `font-family: Manrope`.

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.ts
git commit -m "feat: set Manrope as default font family in Tailwind config"
```

---

### Task 4: Card Component — No-Border Editorial Style

**Files:**
- Modify: `src/components/ui/card.tsx`

The design MD says: "1px solid borders are strictly prohibited for sectioning." Cards use tonal layering (surface-container-lowest on surface background) instead of borders.

- [ ] **Step 1: Update Card base classes**

In `src/components/ui/card.tsx`, replace the Card component's className:

Old:
```typescript
"rounded-lg border bg-card text-card-foreground shadow-sm"
```

New:
```typescript
"rounded-lg bg-card text-card-foreground shadow-[0_12px_40px_rgba(15,28,44,0.04)]"
```

This removes the `border`, removes `shadow-sm`, and adds the ambient tinted shadow from the design spec (blur 40px, Navy-tinted, 4% opacity).

- [ ] **Step 2: Verify cards in browser**

Run: `npm run dev`
Confirm: Dashboard summary cards have no visible border, subtle ambient shadow, white bg on light surface bg.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/card.tsx
git commit -m "feat: remove card borders, add ambient tinted shadow per Modern Trustee spec"
```

---

### Task 5: Button Component — Editorial Roundedness & Variants

**Files:**
- Modify: `src/components/ui/button.tsx`

Design MD specifies:
- Primary: `primary-container` bg with `on-primary-container` text, `xl` (0.75rem) roundedness
- Secondary: `surface-container-highest` bg, no border
- Tertiary: text-only with underline on hover

- [ ] **Step 1: Update button variants**

Replace the `buttonVariants` definition in `src/components/ui/button.tsx`:

```typescript
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "bg-secondary text-secondary-foreground hover:bg-muted",
        secondary: "bg-secondary text-secondary-foreground hover:bg-muted",
        ghost: "hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 rounded-xl px-4",
        lg: "h-11 rounded-xl px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
```

Key changes:
- `rounded-md` → `rounded-xl` (0.75rem) everywhere
- `outline` variant: removed `border border-input`, now uses `bg-secondary` (no border per spec)
- `font-medium` → `font-semibold` for editorial weight
- `px-4` → `px-5` for more breathing room
- `transition-colors` → `transition-all duration-200` for smoother state changes

- [ ] **Step 2: Verify buttons in browser**

Run: `npm run dev`
Navigate to Dashboard → confirm orange primary button, no-border outline buttons with surface bg, rounded-xl corners.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/button.tsx
git commit -m "feat: update button to Modern Trustee editorial style (rounded-xl, no borders)"
```

---

### Task 6: Input Component — Bottom-Border Focus Style

**Files:**
- Modify: `src/components/ui/input.tsx`

Design MD: "Use surface-container-low for background. On focus, background shifts to surface-container-lowest with a 2px primary bottom-border (no full box focus)."

- [ ] **Step 1: Update Input component**

Replace the input className in `src/components/ui/input.tsx`:

Old:
```typescript
"flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
```

New:
```typescript
"flex h-10 w-full rounded-lg border-b-2 border-transparent bg-muted px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:bg-card focus-visible:border-b-primary transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
```

Key changes:
- `border border-input` → `border-b-2 border-transparent` (bottom-only, invisible by default)
- `bg-background` → `bg-muted` (surface-container-low)
- `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` → `focus-visible:bg-card focus-visible:border-b-primary` (bg shifts to white, gold bottom-border appears)
- Added `transition-all duration-200` for smooth focus transition

- [ ] **Step 2: Verify inputs in browser**

Run: `npm run dev`
Navigate to Auth page or any form → confirm: muted bg at rest, on focus bg shifts to white with orange bottom-border.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/input.tsx
git commit -m "feat: input component uses bottom-border focus per Modern Trustee spec"
```

---

### Task 7: AppLayout — Frosted Glass Header

**Files:**
- Modify: `src/components/AppLayout.tsx`

Design MD: "Use surface-variant with 0.8 alpha and blur(12px) for sticky headers."

- [ ] **Step 1: Update header to frosted glass style**

Replace the `<header>` line in `src/components/AppLayout.tsx`:

Old:
```tsx
<header className="h-14 flex items-center border-b bg-card px-4 gap-3">
  <SidebarTrigger />
  <h1 className="text-lg font-semibold text-foreground">Payroll & HR Management System</h1>
</header>
```

New:
```tsx
<header className="sticky top-0 z-10 h-14 flex items-center px-6 gap-3 bg-background/80 backdrop-blur-xl">
  <SidebarTrigger />
  <h1 className="text-base font-semibold tracking-tight text-foreground">JOI Payroll & HR</h1>
</header>
```

Key changes:
- `border-b` removed (no-line rule)
- `bg-card` → `bg-background/80 backdrop-blur-xl` (frosted glass)
- Added `sticky top-0 z-10` so glass effect is visible on scroll
- `px-4` → `px-6` for more breathing room
- Updated title text

- [ ] **Step 2: Verify frosted header**

Run: `npm run dev`
Scroll the dashboard content → confirm header stays sticky with frosted glass blur effect, no bottom border.

- [ ] **Step 3: Commit**

```bash
git add src/components/AppLayout.tsx
git commit -m "feat: frosted glass sticky header per Modern Trustee spec"
```

---

### Task 8: AppSidebar — Navy + Orange Active States

**Files:**
- Modify: `src/components/AppSidebar.tsx`

The sidebar CSS variables already point to Navy in Task 2. This task updates visual details: logo styling, active state orange accent, and editorial typography.

- [ ] **Step 1: Update sidebar header branding**

In `src/components/AppSidebar.tsx`, replace the `SidebarHeader` block:

Old:
```tsx
<SidebarHeader className="p-4">
  {!collapsed && (
    <div className="flex items-center gap-2">
      <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
        <span className="text-sidebar-primary-foreground font-bold text-sm">JH</span>
      </div>
      <div>
        <h2 className="text-sm font-bold text-sidebar-foreground">JOI HR</h2>
        <p className="text-xs text-sidebar-foreground/60">Admin System</p>
      </div>
    </div>
  )}
  {collapsed && (
    <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center mx-auto">
      <span className="text-sidebar-primary-foreground font-bold text-sm">J</span>
    </div>
  )}
</SidebarHeader>
```

New:
```tsx
<SidebarHeader className="p-4">
  {!collapsed && (
    <div className="flex items-center gap-3">
      <div className="h-9 w-9 rounded-xl bg-sidebar-primary flex items-center justify-center">
        <span className="text-sidebar-primary-foreground font-bold text-sm">JOI</span>
      </div>
      <div>
        <h2 className="text-sm font-bold tracking-tight text-sidebar-foreground">JOI Payroll</h2>
        <p className="text-[11px] uppercase tracking-widest text-sidebar-foreground/40 font-medium">HR Management</p>
      </div>
    </div>
  )}
  {collapsed && (
    <div className="h-9 w-9 rounded-xl bg-sidebar-primary flex items-center justify-center mx-auto">
      <span className="text-sidebar-primary-foreground font-bold text-xs">JOI</span>
    </div>
  )}
</SidebarHeader>
```

Key changes:
- `rounded-lg` → `rounded-xl`
- Subtitle is now `uppercase tracking-widest` for editorial label style
- Text changed from "JH"/"JOI HR" to "JOI"/"JOI Payroll"
- Slightly larger logo (h-9 w-9)

- [ ] **Step 2: Update active nav link styling**

Replace the `activeClassName` on both `NavLink` usage sites:

Old:
```tsx
activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
```

New:
```tsx
activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
```

Also update the group labels from `text-sidebar-foreground/50` to `text-sidebar-foreground/30` for a more subtle, editorial label:

Old:
```tsx
<SidebarGroupLabel className="text-sidebar-foreground/50">Menu</SidebarGroupLabel>
```

New:
```tsx
<SidebarGroupLabel className="text-[11px] uppercase tracking-widest text-sidebar-foreground/30 font-medium">Menu</SidebarGroupLabel>
```

And for the HR section:
Old:
```tsx
<SidebarGroupLabel className="text-sidebar-foreground/50">Human Resources</SidebarGroupLabel>
```

New:
```tsx
<SidebarGroupLabel className="text-[11px] uppercase tracking-widest text-sidebar-foreground/30 font-medium">Human Resources</SidebarGroupLabel>
```

- [ ] **Step 3: Verify sidebar in browser**

Run: `npm run dev`
Confirm: Navy background, orange logo badge, active links highlighted with orange text, uppercase editorial labels.

- [ ] **Step 4: Commit**

```bash
git add src/components/AppSidebar.tsx
git commit -m "feat: sidebar uses Navy + orange editorial styling per Modern Trustee"
```

---

### Task 9: Dashboard — Trustee Header & Table Polish

**Files:**
- Modify: `src/pages/Dashboard.tsx`

Design MD: "The Trustee Header: A massive display-lg welcome message that sits asymmetrically to the left." Also: "The Payroll Matrix: headers use surface-container-low, rows use surface-container-lowest, eliminating grid lines."

- [ ] **Step 1: Replace the Dashboard header**

In `src/pages/Dashboard.tsx`, replace:

Old:
```tsx
<h2 className="text-2xl font-bold">Dashboard</h2>
```

New:
```tsx
<div>
  <h2 className="text-4xl font-bold tracking-tight">Dashboard</h2>
  <p className="text-muted-foreground mt-1">Payroll overview and management</p>
</div>
```

This creates the editorial "Display + Body" hierarchy signature.

- [ ] **Step 2: Remove hardcoded border colors from cutoff banner**

Replace the cutoff banner wrapper:

Old:
```tsx
<div className={`border rounded-lg p-4 ${getCutoffColor(displayCutoffUrgency || "")}`}>
```

New:
```tsx
<div className={`rounded-xl p-5 ${getCutoffColor(displayCutoffUrgency || "")}`}>
```

And update `getCutoffColor` to use tonal layering instead of border colors:

Old:
```typescript
const getCutoffColor = (urgency: string) => {
  switch (urgency) {
    case "normal":
      return "bg-blue-50 border-blue-200";
    case "soon":
      return "bg-yellow-50 border-yellow-200";
    case "urgent":
      return "bg-red-50 border-red-200";
    case "overdue":
      return "bg-red-900 border-red-900";
    default:
      return "bg-gray-50 border-gray-200";
  }
};
```

New:
```typescript
const getCutoffColor = (urgency: string) => {
  switch (urgency) {
    case "normal":
      return "bg-primary/5";
    case "soon":
      return "bg-yellow-50";
    case "urgent":
      return "bg-red-50";
    case "overdue":
      return "bg-red-900";
    default:
      return "bg-muted";
  }
};
```

- [ ] **Step 3: Update the employee payroll table to Payroll Matrix style**

Replace the table header and row styling in the "Biweekly Summary" section:

Old:
```tsx
<tr className="border-b">
  <th className="text-left p-2 font-medium text-muted-foreground">ID</th>
```

New:
```tsx
<tr className="bg-muted">
  <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">ID</th>
```

And for each `<th>`:
- `p-2` → `p-3`
- Add `text-xs uppercase tracking-wider`
- `font-medium` → `font-semibold`

Replace row styling:

Old:
```tsx
<tr key={emp.id} className="border-b last:border-0">
```

New:
```tsx
<tr key={emp.id} className="hover:bg-muted/50 transition-colors">
```

And for each `<td>`:
- `p-2` → `p-3`

- [ ] **Step 4: Update spiff preview table similarly**

In the spiff preview dialog table, apply same changes:

Old header:
```tsx
<tr className="border-b">
  <th className="text-left p-2 font-medium">Agent Name</th>
```

New header:
```tsx
<tr className="bg-muted">
  <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Agent Name</th>
```

Old rows:
```tsx
<tr key={idx} className={`border-b last:border-0 ${!item.matchedEmployee ? "bg-yellow-50" : ""}`}>
```

New rows:
```tsx
<tr key={idx} className={`hover:bg-muted/50 transition-colors ${!item.matchedEmployee ? "bg-yellow-50/50" : ""}`}>
```

And for `<td>`: `p-2` → `p-3`

- [ ] **Step 5: Update TCW alerts to remove borders**

In the TCW alerts section, replace:

Old:
```tsx
<div key={idx} className="flex items-center justify-between p-3 border rounded-md">
```

New:
```tsx
<div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
```

Also update the TCW collapsible header hover:

Old:
```tsx
<CardHeader className="cursor-pointer hover:bg-gray-50">
```

New:
```tsx
<CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
```

- [ ] **Step 6: Verify Dashboard in browser**

Run: `npm run dev`
Confirm: Large editorial header, cards with no borders, table uses tonal layering with uppercase editorial headers, no 1px divider lines anywhere.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat: Dashboard uses Trustee Header, Payroll Matrix, zero-divider editorial style"
```

---

### Task 10: Auth Page — Editorial Login Card

**Files:**
- Modify: `src/pages/Auth.tsx`

- [ ] **Step 1: Update the Auth page wrapper and card**

In `src/pages/Auth.tsx`, find the outer wrapper (the return statement's root div) and update it to center the card on a clean surface with editorial typography.

Find the Card usage and update:
- Ensure the card has no explicit `border` class
- Add `shadow-[0_12px_40px_rgba(15,28,44,0.06)]` if not inherited from the base Card
- Update the `CardTitle` text to use `text-2xl tracking-tight`
- Update the form buttons to use the new primary orange style (inherited from button component)

Specifically, if the `<Card>` has a `className` prop with `border`, remove it. The base Card component (updated in Task 4) already handles this.

- [ ] **Step 2: Verify Auth page in browser**

Run: `npm run dev`
Navigate to `/auth` → confirm: clean editorial card centered on surface bg, orange primary button, bottom-border focus inputs, Manrope font throughout.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Auth.tsx
git commit -m "feat: Auth page uses editorial card styling"
```

---

### Task 11: Final Visual QA Pass

**Files:**
- Review all modified pages in browser

- [ ] **Step 1: Check all pages**

Run: `npm run dev` and verify each route:
- `/auth` — Editorial login card, orange CTA, input focus style
- `/` — Trustee Header, summary cards (no borders), Payroll Matrix table
- `/empleados` — Cards and tables follow no-border style
- `/facturas` — Same
- `/historial` — Same

- [ ] **Step 2: Check sidebar navigation**

Verify:
- Navy background (#0f1c2c)
- Orange active state (#FFA700)
- Uppercase editorial group labels
- Hover transitions on menu items

- [ ] **Step 3: Check responsive behavior**

Resize browser to mobile width → confirm sidebar collapses properly, frosted glass header still works, cards stack vertically.

- [ ] **Step 4: Check font rendering**

Open DevTools → confirm all text uses `Manrope` font family. No fallbacks should be visible on a fast connection.

- [ ] **Step 5: Final commit (if any remaining tweaks)**

```bash
git add -A
git commit -m "fix: final visual polish for Modern Trustee design system"
```
