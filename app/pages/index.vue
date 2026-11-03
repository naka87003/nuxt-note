<script setup lang="ts">
definePageMeta({ layout: false });
const { loggedIn } = useUserSession();
const startTo = computed(() => (loggedIn.value ? "/notes" : "/login"));
const features = [
  {
    icon: "i-lucide-file-text",
    title: "Write in Markdown",
    description:
      "Turn quick thoughts into clear notes, then switch to preview whenever you need.",
  },
  {
    icon: "i-lucide-folder",
    title: "Keep notes organized",
    description:
      "Give each note one category — or leave it uncategorized. Your workspace stays simple.",
  },
  {
    icon: "i-lucide-search",
    title: "Find it again, fast",
    description:
      "Search all notes or focus on a category. Browse recent updates at a glance.",
  },
];
</script>

<template>
  <main class="landing">
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-copy">
        <p class="eyebrow">A SPACE FOR YOUR IDEAS</p>
        <h1 id="hero-title"><AppBrand hero /></h1>
        <h2>Capture ideas. Keep what you learn.</h2>
        <p class="intro">
          Write in Markdown, organize notes by category, and find the right idea
          when you need it. A simple home for your growing knowledge.
        </p>
        <UButton :to="startTo" size="xl" class="start-button"
          >Create Your First Note</UButton
        >
      </div>
      <div class="note-preview" aria-label="Note design preview">
        <div class="preview-label">
          <UIcon name="i-lucide-file-text" /> Workspace preview
        </div>
        <h3>Nuxt data fetching</h3>
        <p class="text-dimmed text-sm">Nuxt · Today</p>
        <h4>Overview</h4>
        <p>
          Use useFetch for URL-based requests and useAsyncData for custom async
          logic.
        </p>
        <pre><code>const { data } =
  await useFetch('/api/notes')</code></pre>
        <h4>Checklist</h4>
        <ul>
          <li>Define the response type</li>
          <li>Handle loading and errors</li>
        </ul>
      </div>
    </section>

    <section class="feature-section" aria-labelledby="features-title">
      <h2 id="features-title" class="section-title">
        A little structure. A clearer mind.
      </h2>
      <p class="section-description">
        Everything you need to capture, organize, and revisit useful ideas.
      </p>
      <div class="feature-grid">
        <article
          v-for="feature in features"
          :key="feature.title"
          class="feature-card"
        >
          <UIcon :name="feature.icon" class="feature-icon" />
          <h3>{{ feature.title }}</h3>
          <p>{{ feature.description }}</p>
        </article>
      </div>
    </section>

    <section class="benefits" aria-labelledby="benefits-title">
      <h2 id="benefits-title" class="section-title">
        From a passing thought<br />to something worth keeping.
      </h2>
      <p class="section-description">
        Keep learning notes, code snippets, and everyday ideas together.
      </p>
      <ul>
        <li>
          <UIcon name="i-lucide-circle-check" /> A focused Markdown editor and
          preview
        </li>
        <li>
          <UIcon name="i-lucide-circle-check" /> Flexible categories, without a
          tangle of tags
        </li>
        <li>
          <UIcon name="i-lucide-circle-check" /> Recent notes grouped by their
          last update
        </li>
      </ul>
    </section>

    <section class="cta" aria-labelledby="cta-title">
      <h2 id="cta-title" class="section-title">
        Make room for your next idea.
      </h2>
      <p class="section-description">
        Start with one note. Build a collection you will want to come back to.
      </p>
      <UButton :to="startTo" size="xl" variant="outline" class="start-button"
        >Create Your First Note</UButton
      >
    </section>
    <footer>
      <strong>Nuxt Note</strong><span>A small space for useful ideas.</span>
    </footer>
  </main>
</template>

<style scoped>
.landing {
  max-width: 1184px;
  margin-inline: auto;
  padding: 6rem 1rem 3rem;
  display: flex;
  flex-direction: column;
  gap: 5rem;
}
.hero {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3rem;
  align-items: center;
}
.hero-copy {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  align-items: flex-start;
}
.eyebrow {
  color: var(--ui-primary);
  font-size: 0.75rem;
  font-weight: 600;
}
.hero h2 {
  font-size: 1.5rem;
  font-weight: 600;
}
.intro {
  font-size: 1.25rem;
  line-height: 1.6;
  color: var(--ui-text-dimmed);
}
.start-button {
  min-height: 48px;
  padding-inline: 1.5rem;
}
.note-preview {
  border: 1px solid var(--ui-border);
  border-radius: 1rem;
  padding: 2rem;
  background: var(--ui-bg-muted);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.preview-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--ui-primary);
  font-size: 0.875rem;
}
.note-preview h3 {
  font-size: 1.5rem;
  font-weight: 700;
}
.note-preview h4 {
  font-size: 1.125rem;
  font-weight: 600;
}
.note-preview p,
.note-preview li {
  line-height: 1.6;
}
.note-preview ul {
  padding-left: 1.25rem;
  list-style: disc;
}
pre {
  overflow-x: auto;
  border-radius: 0.5rem;
  padding: 1rem;
  background: var(--ui-bg);
  font-size: 0.8rem;
}
.feature-section,
.cta {
  padding: 3rem;
  border-radius: 2rem;
  background: var(--ui-bg-muted);
  text-align: center;
}
.section-title {
  font-size: clamp(1.75rem, 4vw, 2.5rem);
  font-weight: 700;
  line-height: 1.2;
  color: var(--ui-text-highlighted);
}
.section-description {
  margin-top: 1.5rem;
  color: var(--ui-text-dimmed);
  font-size: 1.125rem;
  line-height: 1.6;
}
.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.5rem;
  margin-top: 2rem;
}
.feature-card {
  padding: 2rem 1.5rem;
  border-radius: 1rem;
  background: var(--ui-bg-elevated);
}
.feature-icon {
  width: 2rem;
  height: 2rem;
  color: var(--ui-primary);
}
.feature-card h3 {
  margin-block: 1.5rem 1rem;
  font-size: 1.25rem;
  font-weight: 600;
}
.feature-card p {
  color: var(--ui-text-dimmed);
  line-height: 1.6;
}
.benefits ul {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 2rem;
}
.benefits li {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}
.benefits li :deep(.iconify) {
  color: var(--ui-primary);
  flex-shrink: 0;
  width: 1.5rem;
  height: 1.5rem;
}
.cta .start-button {
  margin-top: 2rem;
}
footer {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.875rem;
  color: var(--ui-text-dimmed);
}
@media (max-width: 767px) {
  .landing {
    gap: 3rem;
    padding-top: 3rem;
  }
  .hero,
  .feature-grid {
    grid-template-columns: 1fr;
  }
  .hero-copy {
    align-items: center;
    text-align: center;
  }
  .intro {
    font-size: 1rem;
  }
  .hero-copy .start-button {
    width: 100%;
    justify-content: center;
  }
  .feature-section,
  .cta {
    padding: 2rem 1rem;
    border-radius: 1.5rem;
  }
  .note-preview {
    padding: 1.5rem;
  }
  footer {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
}
</style>
