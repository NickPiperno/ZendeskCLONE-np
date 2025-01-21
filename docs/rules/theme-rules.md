# Theme Rules: Modern Skeuomorphic

AutoCRM will use a Modern Skeuomorphic design to provide a visually engaging and intuitive user experience, consistent with the usability requirements in the [User Flow](../project-info/user-flow.md) and our tech choices in the [Tech Stack](../project-info/tech-stack.md).

---

## 1. Core Characteristics

1. **Subtle Realism**  
   - Limited use of depth features (shadows, gradients) to mimic physical objects or slight 3D effects.
2. **Soft Lighting & Shadows**  
   - Tailored box-shadow utilities in Tailwind to create a gentle sense of layering.
3. **Warm Color Palette**  
   - Incorporate neutral backgrounds with soft highlights around interactive elements.
4. **Rounded Edges**  
   - Components can feature a slight rounding to mimic physical, tactile surfaces.

---

## 2. Components & Elements

1. **Buttons**  
   - Raised, subtle shadows on hover/focus states to simulate pressing.  
   - Contrasting color for text to meet accessibility requirements (4.5:1 ratio).

2. **Card Elements (Ticket Overviews, Ticket Details)**  
   - Illusion of layering or stacking, like paper cards in a tray.  
   - Gentle gradient backgrounds and light internal shadows for depth.

3. **Navigation Bars & Side Panels**  
   - Incorporate mild background gradient or texture with consistent shadow.  
   - Indicate active routes with a highlight or subtle "pushed in" effect.

4. **Modals & Dialogs**  
   - Slight translucent layers behind the modal to create a "frosted glass" feel.  
   - Soft edges and shadows to separate content from the underlying page.

---

## 3. Accessibility & Interaction

1. **Keyboard Navigation**  
   - Provide clear visual focus states, possibly via box-shadow or outline.  
   - Use minimal motion that won't distract screen reader users (or provide motion settings toggles).

2. **Shadows as Cues**  
   - Maintain consistent shadow intensities for all "active" or "selected" elements.  
   - Use deeper shadows or slight scale transforms to indicate pressing or selection.

3. **Transitions & Animations**  
   - Subtle transitions on hover/focus (e.g., 200-300ms) for smoother interactions.  
   - Avoid large or abrupt movements that may confuse users.

---

## 4. Consistent Theming via Shadcn UI & Tailwind

1. **Custom Theme Tokens**  
   - Define brand colors and shadow presets in Tailwind config (e.g., boxShadow.skeuo).
   - Ensure color contrast compliance in the Shadcn theme (e.g., text on gradient backgrounds).

2. **Reusable "Skeuo" Classes or Components**  
   - Centralize styles for skeuomorphic elements in one or more base classes.  
   - For instance, a class .skeuo-card might set common shadows, borders, and backgrounds.

3. **Prebuilt Components & Patterns**  
   - Extend Shadcn UI elements with Modern Skeuomorphic styling for consistent design across modals, forms, tables, etc.

---

## 5. Ties to Backend & Real-Time Data

1. **Visual Feedback for Real-Time Updates**  
   - Animate tickets "popping in" or gently sliding into the UI upon creation.  
   - Retain overall softness by avoiding jarring transitions or large motion.

2. **Status Indicators**  
   - Use subtle color-coded badges with beveled edges or drop shadows to reflect state changes (e.g., "Open," "Closed").

3. **AI/Chat Integration**  
   - Chat windows can employ lightly shadowed speech bubbles to enhance realism.  
   - Distinguish AI answers with a slightly different hue or shape.

---

## 6. Performance & Sustainability

1. **Optimize Shadows & Gradients**  
   - Avoid overly heavy or large box-shadow calculations.  
   - Use GPU-accelerated CSS for transitions, limiting CPU overhead.

2. **Responsive Scalable Graphics (SVGs)**  
   - Employ scalable icons to maintain crispness under shadows or highlights.

3. **Lazy-Load Non-Critical Elements**  
   - For skeuomorphic images or textures, load them on demand to keep initial page loads swift.

---

## 7. Common Pitfalls in Modern Skeuomorphic

1. **Overly Dramatic Shadows**  
   - Can make the interface look cartoonish or cluttered. Keep them subtle and consistent.
2. **Excessive Translucency**  
   - Might hamper readability if not enough contrast is provided.
3. **Performance Degradation**  
   - Too many gradient or shadow layers can slow down rendering, especially on mobile devices.

---

## Conclusion

Modern Skeuomorphic design can add visual warmth and familiarity to AutoCRM's UI. By using subtle shadows, gradients, and textures in a performance-minded way, we offer an engaging user experience that aligns with the real-time, data-driven nature of the project. 