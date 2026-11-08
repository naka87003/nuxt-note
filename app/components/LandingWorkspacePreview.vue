<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    mode: "notes" | "chat";
    noteDraft?: boolean;
    hideList?: boolean;
    previewTitle?: string;
    previewContent?: string;
    savedCategory?: string;
  }>(),
  {
    noteDraft: false,
    hideList: false,
    previewTitle: "",
    previewContent: "",
    savedCategory: "",
  },
);

const slots = useSlots();
const interactive = computed(() => !!slots.content);

const isChat = computed(() => props.mode === "chat");

const previewAriaLabel = computed(() => {
  if (interactive.value) {
    return "Interactive demo: turn a conversation into a note";
  }
  if (props.noteDraft) {
    return "Example Chat workspace with a Generate note confirmation: AI organizes the conversation into a draft to review and edit before saving";
  }
  if (isChat.value) {
    return "Example Chat workspace with shared categories and a conversation about useFetch";
  }
  return "Example Notes workspace with categories, recent notes, and a Markdown note about Nuxt data fetching";
});

const noteCategories = [
  { name: "English", count: 8 },
  { name: "Nuxt", count: 6 },
  { name: "TypeScript", count: 6 },
];
const chatCategories = [
  { name: "English", count: 3 },
  { name: "Nuxt", count: 4 },
  { name: "TypeScript", count: 3 },
];

const categories = computed(() => {
  if (isChat.value) return chatCategories;

  // The static preview includes a Nuxt note; the demo adds its note after saving.
  const addedNoteCategory = interactive.value ? props.savedCategory : "Nuxt";
  return noteCategories.map((category) => ({
    name: category.name,
    count: category.count + Number(category.name === addedNoteCategory),
  }));
});

const noteCount = computed(() =>
  interactive.value ? 23 + Number(!!props.savedCategory) : 24,
);
const listCount = computed(() => {
  if (props.savedCategory) return noteCount.value;
  return (
    categories.value.find((category) => category.name === "Nuxt")?.count ?? 0
  );
});

const noteGroups = [
  {
    group: "Today",
    title: "Nuxt data fetching",
    summary: "When to use useFetch and useAsyncData.",
    updated: "Nov 3, 10:24",
  },
  {
    group: "Last 7 Days",
    title: "Server routes and API",
    summary: "Connecting APIs with typed responses.",
    updated: "Nov 2",
  },
  {
    group: "Last Month",
    title: "Runtime config",
    summary: "Configuration and runtime settings.",
    updated: "Oct 18",
  },
  {
    group: "Older",
    title: "Nuxt UI components",
    summary: "Choosing the right UI components.",
    updated: "Sep 14",
  },
];

const chatGroups = [
  {
    group: "Today",
    title: "Understanding useFetch",
    summary: "When to use useFetch and useAsyncData.",
    updated: "Nov 3, 10:24",
  },
  {
    group: "Last 7 Days",
    title: "Auth callback",
    summary: "Debugging a GitHub sign-in callback.",
    updated: "Nov 2",
  },
  {
    group: "Last Month",
    title: "Custom composables",
    summary: "Sharing reusable fetching logic.",
    updated: "Oct 18",
  },
  {
    group: "Older",
    title: "SSR caching",
    summary: "Keeping server responses fresh.",
    updated: "Sep 14",
  },
];

const visibleGroups = computed(() =>
  (isChat.value ? chatGroups : noteGroups).flatMap((item, index) => {
    const isFirstGroup = index === 0;
    const saved = isFirstGroup && !!props.savedCategory;
    if (isFirstGroup && !isChat.value && interactive.value && !saved) return [];
    return [
      {
        group: item.group,
        selected: isFirstGroup,
        title:
          isFirstGroup && props.previewTitle ? props.previewTitle : item.title,
        summary: saved ? props.previewContent : item.summary,
        category: saved ? props.savedCategory : "Nuxt",
        updated: saved ? "Just now" : item.updated,
      },
    ];
  }),
);
</script>

<template>
  <div
    class="preview-frame"
    :class="{ 'has-browser-bar': mode === 'notes' && !noteDraft }"
  >
    <div
      class="product-preview"
      :class="{
        'is-chat': isChat,
        'is-compact': isChat && !noteDraft,
        'is-note-draft': noteDraft,
      }"
      :role="interactive ? 'group' : 'img'"
      :aria-label="previewAriaLabel"
    >
      <!-- Static sample UI is kept out of the tab order; the landing CTA opens the real workspace. -->
      <div v-if="!noteDraft" class="browser-bar" aria-hidden="true">
        ● &nbsp;● &nbsp;● &nbsp;&nbsp;&nbsp; Nuxt Note / Notes
      </div>
      <div class="sample-app" :aria-hidden="interactive ? undefined : true">
        <div class="sample-header" aria-hidden="true">
          <div class="header-actions">
            <UIcon
              name="i-lucide-panel-left-close"
              class="desktop-preview-menu"
            />
            <UIcon
              name="i-lucide-panel-left-open"
              class="mobile-preview-menu"
            />
            <span class="sample-primary">
              + New {{ isChat ? "Chat" : "note" }}
            </span>
          </div>
          <AppBrand class="sample-brand" />
          <img
            src="/images/preview-avatar.png"
            alt=""
            width="28"
            height="28"
            loading="lazy"
          />
        </div>
        <div class="sample-body">
          <div class="sample-sidebar" aria-hidden="true">
            <div class="category-link" :class="{ selected: !!savedCategory }">
              <UIcon name="i-lucide-files" />
              All {{ isChat ? "chats" : "notes" }}
              <small>{{ isChat ? 12 : noteCount }}</small>
            </div>
            <div class="category-link">
              <UIcon name="i-lucide-folder" />
              Uncategorized
              <small>
                {{ isChat ? 2 : 3 + Number(savedCategory === "Uncategorized") }}
              </small>
            </div>
            <p class="category-heading">Categories</p>
            <div
              v-for="category in categories"
              :key="category.name"
              class="category-link"
              :class="{ selected: !savedCategory && category.name === 'Nuxt' }"
            >
              <UIcon name="i-lucide-folder" />
              {{ category.name }}
              <small>{{ category.count }}</small>
            </div>
            <div class="new-category">+ New category</div>
            <div class="sample-tabs">
              <span :class="{ current: !isChat }">
                <UIcon name="i-lucide-file-text" />
                Notes
              </span>
              <span :class="{ current: isChat }">
                <UIcon name="i-lucide-message-circle" />
                Chat
              </span>
            </div>
          </div>
          <div v-if="!hideList" class="sample-list" aria-hidden="true">
            <div class="list-top">
              <div class="sample-list-heading">
                <strong>{{ savedCategory ? "All notes" : "Nuxt" }}</strong>
                <span class="sample-hide-list">
                  <UIcon name="i-lucide-panel-left-close" />
                </span>
              </div>
              <div class="sample-list-actions">
                <small>
                  {{ listCount }}
                  {{ isChat ? "chats" : "notes" }}
                </small>
                <span class="sample-outline">
                  + New {{ isChat ? "Chat" : "note" }}
                </span>
              </div>
              <div class="sample-search">
                {{ savedCategory ? "Search notes…" : "Search in Nuxt…" }}
              </div>
              <small>Grouped by last updated</small>
            </div>
            <div
              v-for="item in visibleGroups"
              :key="item.group"
              class="sample-group"
            >
              <p>{{ item.group }}</p>
              <div
                class="sample-list-card"
                :class="{ selected: item.selected }"
              >
                <strong class="wrap-break-word">{{ item.title }}</strong>
                <p v-if="item.summary" class="line-clamp-2">
                  {{ item.summary }}
                </p>
                <small>{{ item.category }} · {{ item.updated }}</small>
              </div>
            </div>
          </div>
          <slot name="content">
            <div class="sample-content">
              <div class="sample-toolbar">
                <span class="back-label">← Back</span>
                <small v-if="!isChat" class="sample-note-meta">
                  Nuxt · Created Nov 1 · Updated Nov 3, 10:24
                </small>
                <div class="sample-actions">
                  <span v-if="isChat" class="sample-primary"
                    >Generate note</span
                  >
                  <div class="sample-secondary-actions">
                    <span :class="isChat ? 'sample-soft' : 'sample-primary'">
                      <template v-if="isChat">
                        <span class="sample-category-prefix">
                          Category:&nbsp;
                        </span>
                        Nuxt
                      </template>
                      <template v-else>Edit</template>
                    </span>
                    <span class="sample-soft">Delete</span>
                  </div>
                </div>
              </div>
              <LandingSampleNote v-if="!isChat" />
              <LandingSampleConversation v-else />
            </div>
          </slot>
        </div>
      </div>
      <slot name="overlay">
        <LandingNoteDraftConfirmation v-if="noteDraft && !interactive" />
      </slot>
    </div>
  </div>
</template>

<style scoped>
.preview-frame {
  container-type: inline-size;
  --preview-width: 1440;
  --preview-height: 900;
  --preview-chrome-height: 0;
  position: relative;
  width: 100%;
  min-width: 0;
  aspect-ratio: var(--preview-width) /
    calc(var(--preview-height) + var(--preview-chrome-height) + 2);
  overflow: hidden;
}
.preview-frame.has-browser-bar {
  --preview-chrome-height: 40;
}
.product-preview {
  position: relative;
  width: calc(var(--preview-width) * 1px);
  /* Scale the complete layout against its responsive reference width. */
  transform: scale(calc(100cqw / (var(--preview-width) * 1px)));
  transform-origin: top left;
  isolation: isolate;
  border: 1px solid var(--ui-border);
  border-radius: 16px;
  overflow: hidden;
  background: var(--ui-bg);
  font-size: 14px;
  line-height: 20px;
}
.browser-bar {
  height: 40px;
  display: flex;
  align-items: center;
  padding-inline: 24px;
  background: var(--ui-bg-muted);
  color: var(--ui-text-dimmed);
  font-size: 12px;
}
.sample-app {
  height: calc(var(--preview-height) * 1px);
  display: flex;
  flex-direction: column;
}
.sample-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  flex-shrink: 0;
  padding: 0 16px;
  background: var(--ui-bg-muted);
  border-bottom: 1px solid var(--ui-border);
}
.sample-header > img {
  width: 28px;
  height: 28px;
  border-radius: 50%;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}
.header-actions > .iconify {
  color: color-mix(in oklab, var(--ui-text-dimmed) 80%, transparent);
  width: 20px;
  height: 20px;
}
.mobile-preview-menu {
  display: none;
}
.sample-brand {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: 24px;
}
.sample-primary,
.sample-soft,
.sample-outline,
.new-category {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 700;
}
.sample-primary {
  color: var(--ui-bg);
  background: var(--ui-primary);
}
.sample-soft {
  background: var(--ui-bg-elevated);
}
.sample-outline {
  box-shadow: inset 0 0 0 1px var(--ui-border-accented);
  white-space: nowrap;
}
.sample-body {
  display: flex;
  flex: 1;
  min-height: 0;
}
.sample-sidebar {
  flex: 0 0 288px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  background: var(--ui-bg-muted);
  border-right: 1px solid var(--ui-border);
}
.category-link {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 4px;
}
.category-link .iconify {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
small {
  font-size: 12px;
  color: var(--ui-text-dimmed);
}
.category-link small {
  margin-left: auto;
}
.category-heading {
  margin: 12px 8px 4px;
  color: var(--ui-text-dimmed);
}
.selected {
  background: var(--ui-bg-elevated);
}
.category-link.selected,
.sample-list-card.selected strong {
  color: var(--ui-primary);
}
.new-category {
  background: var(--ui-bg-elevated);
  margin-top: 12px;
}
.sample-tabs {
  display: flex;
  height: 36px;
  padding: 4px;
  background: var(--ui-bg-elevated);
  border-radius: 6px;
  margin-top: auto;
}
.sample-tabs > span {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-width: 0;
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
}
.sample-tabs > span > .iconify {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
}
.sample-tabs > .current {
  background: var(--ui-primary);
  color: var(--ui-bg);
  border-radius: 4px;
}
.sample-list {
  flex: 0 0 340px;
  border-right: 1px solid var(--ui-border);
  padding: 16px;
  min-width: 0;
}
.sample-list-heading {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-height: 32px;
  margin-bottom: 10px;
}
.sample-list-heading strong {
  flex: 1;
  min-width: 0;
  font-size: 20px;
  overflow-wrap: anywhere;
}
.sample-list-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.sample-hide-list {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 32px;
  height: 32px;
  color: color-mix(in oklab, var(--ui-text-dimmed) 80%, transparent);
}
.sample-hide-list .iconify {
  width: 16px;
  height: 16px;
}
.sample-search {
  border: 1px solid var(--ui-border-accented);
  border-radius: 4px;
  padding: 6px 10px;
  color: var(--ui-text-dimmed);
}
.sample-group > p {
  margin-block: 12px 6px;
  font-weight: 500;
}
.sample-list-card {
  padding: 14px;
  border: 1px solid var(--ui-border);
  border-radius: 5px;
}
.sample-list-card p {
  color: var(--ui-text-dimmed);
  font-size: 12px;
  margin: 4px 0;
}
.sample-content {
  font-size: 16px;
  line-height: 1.7;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.sample-toolbar {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: space-between;
  align-items: center;
  min-height: 64px;
  padding: 12px 24px;
  border-bottom: 1px solid var(--ui-border);
}
.sample-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  min-width: 0;
}
.sample-actions > .sample-primary,
.sample-secondary-actions > span {
  white-space: nowrap;
}
.sample-actions > .sample-primary,
.sample-secondary-actions > .sample-primary {
  min-width: 80px;
}
.sample-secondary-actions > .sample-soft:last-child {
  min-width: 64px;
}
.sample-secondary-actions {
  display: flex;
  gap: inherit;
  min-width: 0;
}
.sample-note-meta {
  flex: 1 1 180px;
  min-width: 0;
}
.back-label {
  display: none;
}
.is-note-draft {
  border-radius: 8px;
}
.is-chat .browser-bar {
  display: none;
}
.is-compact {
  border-radius: 0;
}
/* Change layout only; buttons, text and spacing retain their shared sizes. */
@media (min-width: 768px) and (max-width: 1279px) {
  .preview-frame {
    --preview-width: 1024;
  }
  .sample-sidebar {
    display: none;
  }
}
@media (max-width: 767px) {
  .preview-frame {
    --preview-width: 390;
    --preview-height: 844;
  }
  .preview-frame.has-browser-bar {
    --preview-chrome-height: 0;
  }
  .browser-bar,
  .sample-sidebar,
  .sample-list,
  .sample-brand,
  .sample-category-prefix,
  .header-actions > .desktop-preview-menu {
    display: none;
  }
  .header-actions > .mobile-preview-menu {
    display: inline-block;
  }
  .back-label {
    display: block;
  }
  .sample-note-meta {
    flex-basis: 100%;
    order: 1;
  }
}
</style>
