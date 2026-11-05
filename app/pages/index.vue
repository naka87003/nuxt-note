<script setup lang="ts">
definePageMeta({ layout: false });
const { loggedIn } = useUserSession();
const startTo = computed(() => (loggedIn.value ? "/notes" : "/login"));
const opening = ref<"header" | "hero" | "closing" | null>(null);

async function openNotebook(event: MouseEvent, source: typeof opening.value) {
  if (!loggedIn.value) return;
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  event.preventDefault();
  if (opening.value) return;
  opening.value = source;
  try {
    const failure = await navigateTo(startTo.value);
    // Successful routing can finish before the destination's async setup.
    // Keep loading until this page is unmounted; reset only on failure.
    if (failure !== undefined) opening.value = null;
  } catch (error) {
    opening.value = null;
    throw error;
  }
}
const features = [
  {
    label: "Markdown",
    line: "# My next idea",
    hint: "Write → Preview → Save",
    title: "Write with focus",
    description:
      "Capture ideas in Markdown. Read, edit, and preview without losing your train of thought.",
  },
  {
    label: "Categories",
    line: "English · Nuxt · TypeScript",
    hint: "A little structure. Less searching.",
    title: "Keep it organized",
    description:
      "Organize notes and conversations with shared categories, focused search, and recent updates.",
  },
  {
    label: "AI Chat",
    line: "What would you like to explore?",
    hint: "Ask → Explore → Keep learning",
    title: "Think with AI",
    description:
      "Explore a question, untangle a concept, and keep the ideas that matter in your notes.",
  },
];
const steps = [
  { title: "Capture", description: "Write a thought before it slips away." },
  { title: "Explore", description: "Ask AI to help you understand more." },
  { title: "Keep", description: "Save useful ideas in your own notes." },
];
useSeoMeta({
  title: "Nuxt Note — Keep your ideas. Grow your thinking.",
  description:
    "A focused notebook. A thoughtful AI conversation. Capture ideas in Markdown and organize notes and conversations with shared categories.",
});
</script>

<template>
  <div class="landing">
    <a href="#main-content" class="skip-link">Skip to content</a>
    <header class="public-header">
      <NuxtLink to="/" aria-label="Nuxt Note home"><AppBrand /></NuxtLink>
      <nav aria-label="Main navigation">
        <div class="section-links">
          <UButton to="#notes" color="neutral" variant="ghost">Notes</UButton>
          <UButton to="#ai-chat" color="neutral" variant="ghost"
            >AI Chat</UButton
          >
          <UButton to="#features" color="neutral" variant="ghost"
            >Features</UButton
          >
        </div>
        <ThemePicker />
        <UButton
          :to="startTo"
          :loading="opening === 'header'"
          :disabled="opening !== null"
          color="neutral"
          variant="outline"
          class="sign-in"
          @click="openNotebook($event, 'header')"
        >
          {{ loggedIn ? "Open notebook" : "Sign in" }}
        </UButton>
      </nav>
    </header>
    <main id="main-content" class="landing-sections">
      <section class="hero" aria-labelledby="hero-title">
        <div class="hero-copy">
          <p class="eyebrow">YOUR IDEAS, WITH ROOM TO GROW</p>
          <h1 id="hero-title">
            Keep your ideas.<span>Grow your thinking.</span>
          </h1>
          <p class="description">
            A focused notebook. A thoughtful AI conversation.<br
              class="medium-break"
            />
            One place to capture what you learn and explore what comes next.
          </p>
          <div class="hero-actions">
            <UButton
              :to="startTo"
              :loading="opening === 'hero'"
              :disabled="opening !== null"
              size="xl"
              @click="openNotebook($event, 'hero')"
            >
              Start your notebook
            </UButton>
            <UButton to="#notes" color="neutral" variant="outline" size="xl">
              Explore the workspace
            </UButton>
          </div>
          <p class="small-copy">Sign in with GitHub · Your own workspace</p>
        </div>
        <LandingNoteIllustration class="hero-art" />
      </section>
      <ul class="capabilities" aria-label="Notebook capabilities">
        <li>Markdown <span>notes</span></li>
        <li>Categories <span>&amp; search</span></li>
        <li>AI <span>conversations</span></li>
      </ul>
      <section id="notes" class="notes-section" aria-labelledby="notes-title">
        <p class="eyebrow">YOUR NOTEBOOK, AT A GLANCE</p>
        <h2 id="notes-title">A clear place for every idea.</h2>
        <p class="description">
          Collect the useful things. Give them a home. Find them when you need
          them.
        </p>
        <LandingWorkspacePreview mode="notes" />
      </section>
      <section
        id="features"
        class="features-section"
        aria-labelledby="features-title"
      >
        <h2 id="features-title">Small tools. More room to think.</h2>
        <p class="description">
          Writing, organizing, and asking better questions — together.
        </p>
        <div class="feature-grid">
          <article
            v-for="feature in features"
            :key="feature.title"
            class="feature-card"
          >
            <div class="feature-art">
              <div>
                <UIcon name="i-lucide-file-text" /><span>{{
                  feature.label
                }}</span>
              </div>
              <p>{{ feature.line }}</p>
              <small>{{ feature.hint }}</small>
            </div>
            <h3>{{ feature.title }}</h3>
            <p>{{ feature.description }}</p>
          </article>
        </div>
      </section>
      <section id="ai-chat" class="ai-section" aria-labelledby="ai-title">
        <div class="ai-copy">
          <LandingAiIllustration class="ai-art" width="144" height="144" />
          <p class="eyebrow">A CONVERSATION CAN OPEN A DOOR</p>
          <h2 id="ai-title">Go a little deeper.</h2>
          <p class="description">
            Ask a question, work through a problem, or explore a new idea.
            Organize notes and conversations with shared categories.
          </p>
        </div>
        <figure class="chat-preview">
          <LandingWorkspacePreview mode="chat" />
          <figcaption class="small-copy">
            The familiar Nuxt Chat experience, inside your notebook.
          </figcaption>
        </figure>
      </section>
      <section
        id="chat-to-note"
        class="chat-note-section"
        aria-labelledby="chat-note-title"
      >
        <p class="eyebrow">
          <span class="chat-note-eyebrow-desktop">
            FROM CONVERSATION TO SOMETHING WORTH KEEPING
          </span>
          <span class="chat-note-eyebrow-mobile"
            >FROM CONVERSATION TO NOTE</span
          >
        </p>
        <h2 id="chat-note-title">Turn a good conversation into a note.</h2>
        <p class="description">
          Turn the useful parts of a conversation into a Markdown draft. Review
          and edit it before saving to Notes.
        </p>
        <LandingChatNoteDemo />
      </section>
      <section class="workflow" aria-labelledby="workflow-title">
        <h2 id="workflow-title">
          From a passing thought to something worth keeping.
        </h2>
        <ol>
          <li v-for="(step, index) in steps" :key="step.title">
            <span class="eyebrow">0{{ index + 1 }}</span>
            <h3>{{ step.title }}</h3>
            <p>{{ step.description }}</p>
          </li>
        </ol>
      </section>
      <section class="closing-cta" aria-labelledby="cta-title">
        <h2 id="cta-title">Make space for your next idea.</h2>
        <p class="description">Start with a note. Follow your curiosity.</p>
        <UButton
          :to="startTo"
          :loading="opening === 'closing'"
          :disabled="opening !== null"
          size="xl"
          @click="openNotebook($event, 'closing')"
        >
          Start your notebook
        </UButton>
      </section>
    </main>
    <footer class="public-footer">
      <NuxtLink to="/" aria-label="Nuxt Note home"><AppBrand /></NuxtLink>
      <p>A small space for notes. More room for ideas.</p>
    </footer>
  </div>
</template>

<style scoped>
.landing {
  max-width: 1216px;
  margin-inline: auto;
  padding: 0 32px 32px;
}
.public-header,
.public-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}
.public-header {
  height: 72px;
  margin-bottom: 80px;
}
.public-header nav,
.section-links {
  display: flex;
  align-items: center;
  gap: 16px;
}
.public-header :deep(.brand),
.public-footer :deep(.brand) {
  font-weight: 800;
}
.public-header nav a {
  min-height: 48px;
  justify-content: center;
  font-weight: 700;
  padding-inline: 20px;
}
.sign-in {
  min-width: 108px;
}
.landing-sections {
  display: flex;
  flex-direction: column;
  gap: 80px;
}
section[id] {
  scroll-margin-top: 24px;
}
.hero {
  display: grid;
  grid-template-columns: 528px minmax(0, 1fr);
  align-items: center;
  gap: 24px;
  min-height: 480px;
}
.hero-copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 24px;
}
.eyebrow {
  color: var(--ui-primary);
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
}
h1 {
  color: var(--ui-text-highlighted);
  font-size: 54px;
  font-weight: 800;
  line-height: 61px;
}
h1 span {
  display: block;
  margin-top: 24px;
  color: var(--ui-primary);
  font-size: 48px;
  line-height: 56px;
}
h2 {
  color: var(--ui-text-highlighted);
  font-size: 40px;
  font-weight: 700;
  line-height: 48px;
}
.description {
  color: var(--ui-text-dimmed);
  font-size: 18px;
  line-height: 29px;
}
.hero-art {
  width: 600px;
  max-width: 100%;
  height: auto;
  aspect-ratio: 3 / 2;
  object-fit: contain;
}
.hero-actions {
  display: flex;
  gap: 12px;
}
.hero-actions a,
.closing-cta a {
  min-height: 48px;
  justify-content: center;
  font-weight: 700;
}
.hero-actions a:first-child {
  width: 232px;
}
.hero-actions a:last-child {
  width: 260px;
}
.small-copy {
  font-size: 12px;
  line-height: 20px;
  color: var(--ui-text-dimmed);
}
.capabilities {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  align-items: center;
  min-height: 64px;
  border-radius: 16px;
  background: var(--ui-bg-muted);
  padding: 16px;
  font-size: 14px;
  font-weight: 500;
}
.notes-section,
.chat-note-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.chat-note-eyebrow-mobile {
  display: none;
}
.features-section {
  padding: 48px;
  border-radius: 32px;
  background: var(--ui-bg-muted);
  text-align: center;
}
.features-section > .description {
  margin-block: 24px;
}
.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
  padding-bottom: 27px;
}
.feature-card {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px;
  border-radius: 16px;
  background: var(--ui-bg-elevated);
}
.feature-art {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 132px;
  height: 132px;
  flex-shrink: 0;
  border-radius: 8px;
  padding: 16px;
  background: var(--ui-bg);
  text-align: left;
}
.feature-art div {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--ui-primary);
  font-size: 14px;
  font-weight: 600;
}
.feature-art .iconify {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}
.feature-art p {
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
}
.feature-art small {
  font-size: 12px;
  line-height: 20px;
  color: var(--ui-text-dimmed);
}
.feature-card h3 {
  font-size: 22px;
  line-height: 29px;
  font-weight: 600;
}
.feature-card > p {
  color: var(--ui-text-dimmed);
  font-size: 16px;
  line-height: 26px;
}
.ai-section {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 48px;
  align-items: center;
  min-height: 450px;
}
.ai-copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
}
.ai-copy .ai-art {
  width: 144px;
  height: 144px;
  object-fit: contain;
}
.chat-preview {
  min-width: 0;
}
.chat-preview figcaption {
  margin-top: 12px;
  text-align: center;
}
.workflow h2 {
  font-size: 36px;
  line-height: 44px;
  text-align: center;
}
.workflow ol {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
  margin-top: 24px;
  min-height: 140px;
}
.workflow li {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.workflow h3 {
  font-size: 24px;
  font-weight: 600;
  line-height: 32px;
}
.workflow li p {
  font-size: 16px;
  line-height: 25px;
  color: var(--ui-text-dimmed);
}
.closing-cta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 48px;
  border-radius: 32px;
  background: var(--ui-bg-muted);
  text-align: center;
}
.closing-cta a {
  width: 256px;
}
.public-footer {
  margin-top: 80px;
  min-height: 64px;
}
.public-footer p {
  flex-basis: 540px;
  color: var(--ui-text-dimmed);
  font-size: 14px;
  line-height: 22px;
}
.skip-link {
  position: absolute;
  left: 16px;
  top: -80px;
  z-index: 50;
  background: var(--ui-bg-elevated);
  padding: 12px;
  border-radius: 6px;
}
.skip-link:focus {
  top: 12px;
}
@media (max-width: 1279px) {
  .public-header {
    margin-bottom: 64px;
  }
  .landing-sections {
    gap: 64px;
  }
  .hero {
    grid-template-columns: 1fr;
    justify-items: center;
    gap: 32px;
  }
  .hero-copy {
    align-items: center;
    text-align: center;
  }
  .hero-art {
    width: 480px;
  }
  .capabilities {
    text-align: center;
  }
  .ai-section {
    grid-template-columns: 1fr;
    gap: 32px;
  }
  .ai-copy {
    align-items: center;
    text-align: center;
  }
  .public-footer {
    margin-top: 64px;
  }
  .public-footer p {
    flex: 1;
  }
}
@media (min-width: 960px) and (max-width: 1279px) {
  .feature-art {
    height: 152px;
  }
}
@media (max-width: 959px) {
  .feature-grid {
    grid-template-columns: 1fr;
    padding-bottom: 0;
  }
}
@media (max-width: 899px) {
  .section-links {
    display: none;
  }
}
@media (max-width: 767px) {
  .chat-note-eyebrow-desktop {
    display: none;
  }
  .chat-note-eyebrow-mobile {
    display: inline;
  }
  .landing {
    padding: 0 16px 24px;
  }
  .public-header {
    height: 64px;
    margin-bottom: 48px;
    gap: 12px;
  }
  .sign-in {
    min-width: 96px;
  }
  .landing-sections {
    gap: 48px;
  }
  .hero {
    gap: 16px;
  }
  .hero-copy {
    width: 100%;
    align-items: stretch;
    text-align: left;
    gap: 16px;
  }
  .hero .eyebrow {
    font-size: 11px;
  }
  h1 {
    font-size: clamp(30px, 9.23vw, 36px);
    line-height: 42px;
  }
  h1 span {
    font-size: clamp(27px, 8.72vw, 34px);
    line-height: 40px;
    margin-top: 16px;
  }
  h2,
  .workflow h2 {
    font-size: 30px;
    line-height: 38px;
  }
  .description {
    font-size: 16px;
    line-height: 25px;
  }
  .medium-break {
    display: none;
  }
  .hero-actions {
    flex-direction: column;
    gap: 16px;
  }
  .hero-actions a:first-child,
  .hero-actions a:last-child {
    width: 100%;
  }
  .hero-art {
    width: 100%;
  }
  .capabilities {
    font-size: 12px;
    line-height: 16px;
    padding: 12px;
    gap: 8px;
  }
  .capabilities span {
    display: block;
  }
  .notes-section {
    gap: 16px;
  }
  .features-section {
    padding: 24px;
    border-radius: 16px;
  }
  .feature-card {
    padding: 20px;
  }
  .ai-section {
    gap: 24px;
  }
  .ai-copy {
    align-items: flex-start;
    text-align: left;
  }
  .ai-copy .ai-art {
    width: 112px;
    height: 112px;
  }
  .workflow h2 {
    text-align: left;
  }
  .workflow ol {
    grid-template-columns: 1fr;
  }
  .workflow li {
    gap: 8px;
  }
  .closing-cta {
    padding: 24px;
    border-radius: 16px;
  }
  .closing-cta a {
    width: 100%;
  }
  .public-footer {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    margin-top: 48px;
  }
  .public-footer p {
    font-size: 12px;
    line-height: 20px;
  }
}
</style>
