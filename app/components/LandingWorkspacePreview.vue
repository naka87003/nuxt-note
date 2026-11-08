<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    mode: "notes" | "chat";
    noteDraft?: boolean;
    previewTitle?: string;
    previewContent?: string;
    savedCategory?: string;
  }>(),
  { noteDraft: false, previewTitle: "", previewContent: "", savedCategory: "" },
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
          <UIcon name="i-lucide-panel-left-open" class="mobile-preview-menu" />
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
        <div class="sample-list" aria-hidden="true">
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
            <div class="sample-list-card" :class="{ selected: item.selected }">
              <strong class="wrap-break-word">{{ item.title }}</strong>
              <p v-if="item.summary" class="line-clamp-2">{{ item.summary }}</p>
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
                <span v-if="isChat" class="sample-primary">Generate note</span>
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
</template>

<style scoped>
.product-preview {
  position: relative;
  width: 100%;
  border: 1px solid var(--ui-border);
  border-radius: 16px;
  overflow: hidden;
  background: var(--ui-bg);
  font-size: 12px;
  line-height: 1.6;
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
  height: 720px;
  display: flex;
  flex-direction: column;
}
.sample-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  flex-shrink: 0;
  padding: 0 13px;
  background: var(--ui-bg-muted);
  border-bottom: 1px solid var(--ui-border);
}
.sample-header > img {
  width: 23px;
  height: 23px;
  border-radius: 50%;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 13px;
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
}
.sample-brand :deep(.brand-title) {
  font-size: 19px;
}
.sample-brand :deep(.brand-symbol) {
  width: 27px;
  height: auto;
}
.sample-primary,
.sample-soft,
.sample-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 11px;
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
  border: 1px solid var(--ui-border-accented);
  white-space: nowrap;
}
.sample-body {
  display: flex;
  flex: 1;
  min-height: 0;
}
.sample-sidebar {
  flex: 0 0 20%;
  padding: 13px;
  display: flex;
  flex-direction: column;
  background: var(--ui-bg-muted);
  border-right: 1px solid var(--ui-border);
}
.category-link {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  border-radius: 4px;
}
.category-link .iconify {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
small {
  font-size: 0.85em;
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
  margin-top: 4px;
  padding: 3px;
  text-align: center;
}
.sample-tabs {
  display: flex;
  height: 29px;
  padding: 3px;
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
  font-size: 10px;
  font-weight: 500;
  line-height: 13px;
}
.sample-tabs > span > .iconify {
  width: 13px;
  height: 13px;
  flex: 0 0 13px;
}
.sample-tabs > .current {
  background: var(--ui-primary);
  color: var(--ui-bg);
  border-radius: 4px;
}
.sample-list {
  flex: 0 0 23.61%;
  border-right: 1px solid var(--ui-border);
  padding: 13px;
  min-width: 0;
}
.sample-list-heading {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-height: 26px;
  margin-bottom: 10px;
}
.sample-list-heading strong {
  flex: 1;
  min-width: 0;
  font-size: 16px;
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
  flex: 0 0 26px;
  height: 26px;
  color: color-mix(in oklab, var(--ui-text-dimmed) 80%, transparent);
}
.sample-hide-list .iconify {
  width: 16px;
  height: 16px;
}
.sample-search {
  border: 1px solid var(--ui-border-accented);
  border-radius: 4px;
  padding: 4px 8px;
  color: var(--ui-text-dimmed);
}
.sample-group > p {
  margin-block: 12px 6px;
  font-weight: 500;
}
.sample-list-card {
  padding: 10px;
  border: 1px solid var(--ui-border);
  border-radius: 5px;
}
.sample-list-card p {
  color: var(--ui-text-dimmed);
  font-size: 11px;
  margin: 4px 0;
}
.sample-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.sample-toolbar {
  display: flex;
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
  min-height: 32px;
  padding: 6px 10px;
  font-size: 14px;
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
  color: var(--ui-text-dimmed);
  font-size: 10px;
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
.is-compact .sample-brand {
  gap: 3px;
}
@media (min-width: 1280px) {
  .is-compact .sample-primary,
  .is-compact .sample-soft,
  .is-compact .sample-outline {
    border-radius: 2px;
  }
  .is-compact {
    font-size: 6px;
  }
  .is-compact .sample-app {
    height: 345px;
  }
  .is-compact .sample-header {
    height: 25px;
    padding-inline: 6px;
  }
  .is-compact .sample-header > img {
    width: 11px;
    height: 11px;
  }
  .is-compact .header-actions {
    gap: 6px;
  }
  .is-compact .header-actions > .iconify {
    width: 10px;
    height: 10px;
  }
  .is-compact .sample-brand :deep(.brand-title) {
    font-size: 9px;
  }
  .is-compact .sample-brand :deep(.brand-symbol) {
    width: 13px;
  }
  .is-compact .sample-primary,
  .is-compact .sample-soft,
  .is-compact .sample-outline {
    padding: 2px 4px;
    font-size: 5px;
  }
  .is-compact .sample-sidebar,
  .is-compact .sample-list {
    padding: 6px;
  }
  .is-compact .category-link {
    padding: 2px 4px;
    gap: 2px;
  }
  .is-compact .category-link .iconify {
    width: 8px;
    height: 8px;
  }
  .is-compact .category-heading {
    margin: 6px 4px 2px;
  }
  .is-compact .sample-tabs {
    height: 14px;
    padding: 1.5px;
  }
  .is-compact .sample-tabs > span {
    font-size: 5px;
    gap: 3px;
    line-height: 6px;
  }
  .is-compact .sample-tabs > span > .iconify {
    width: 6px;
    height: 6px;
    flex-basis: 6px;
  }
  .is-compact .new-category {
    padding: 1px;
  }
  .is-compact .sample-list-heading {
    min-height: 13px;
    gap: 5px;
    margin-bottom: 5px;
  }
  .is-compact .sample-list-heading strong {
    font-size: 8px;
  }
  .is-compact .sample-hide-list {
    flex-basis: 13px;
    height: 13px;
  }
  .is-compact .sample-hide-list .iconify {
    width: 8px;
    height: 8px;
  }
  .is-compact .sample-list-actions {
    gap: 4px;
    margin-bottom: 4px;
  }
  .is-compact .sample-search {
    padding: 2px 4px;
  }
  .is-compact .sample-group > p {
    margin-block: 6px 3px;
  }
  .is-compact .sample-list-card {
    padding: 5px;
  }
  .is-compact .sample-list-card p {
    font-size: 5px;
    margin-block: 2px;
  }
  .is-compact .sample-toolbar {
    min-height: 32px;
    gap: 6px;
    padding: 6px 12px;
  }
  .is-compact .sample-actions {
    gap: 4px;
  }
  .is-compact .sample-actions > .sample-primary,
  .is-compact .sample-secondary-actions > span {
    min-height: 16px;
    padding: 3px 5px;
    font-size: 7px;
  }
  .is-compact .sample-actions > .sample-primary,
  .is-compact .sample-secondary-actions > .sample-primary {
    min-width: 40px;
  }
  .is-compact .sample-secondary-actions > .sample-soft:last-child {
    min-width: 32px;
  }
  .is-note-draft .sample-app {
    height: 800px;
  }
}
@media (min-width: 768px) and (max-width: 1279px) {
  .product-preview {
    font-size: 14px;
  }
  .sample-app {
    height: 844px;
  }
  .sample-sidebar {
    display: none;
  }
  .sample-list {
    flex-basis: 33.2%;
  }
  .sample-header {
    height: 60px;
    padding-inline: 15px;
  }
  .sample-header > img {
    width: 26px;
    height: 26px;
  }
  .is-chat .header-actions {
    gap: 14px;
  }
  .is-chat .sample-brand :deep(.brand-title) {
    font-size: 22px;
  }
  .is-chat .sample-brand :deep(.brand-symbol) {
    width: 31px;
  }
  .sample-primary,
  .sample-soft,
  .sample-outline {
    padding: 4px 12px;
    font-size: 12px;
  }
  .is-chat .sample-list {
    padding: 15px;
  }
  .is-chat .sample-list-heading {
    margin-bottom: 14px;
  }
  .is-chat .sample-search {
    padding: 5px 9px;
  }
  .is-chat .sample-group > p {
    margin-block: 14px 7px;
  }
  .is-chat .sample-list-card {
    padding: 12px;
  }
  .is-chat .sample-list-card p {
    font-size: 12px;
  }
}
@media (min-width: 768px) and (max-width: 959px) {
  .sample-list {
    flex-basis: 36.5%;
  }
  .sample-app {
    height: 825px;
  }
}
@media (max-width: 767px) {
  .sample-category-prefix {
    display: none;
  }
  .header-actions > .desktop-preview-menu {
    display: none;
  }
  .header-actions > .mobile-preview-menu {
    display: inline-block;
  }
  .product-preview {
    font-size: 13px;
    border-radius: 16px;
  }
  .sample-app {
    height: 775px;
  }
  .browser-bar,
  .sample-sidebar,
  .sample-list,
  .sample-brand {
    display: none;
  }
  .sample-header {
    height: 59px;
    padding-inline: 12px;
  }
  .sample-header > img {
    width: 26px;
    height: 26px;
  }
  .header-actions {
    gap: 16px;
  }
  .header-actions > .iconify {
    width: 22px;
    height: 22px;
    color: var(--ui-text);
  }
  .sample-primary,
  .sample-soft {
    padding: 5px 12px;
    font-size: 12px;
  }
  .sample-toolbar {
    padding: 8px 16px;
  }
  .sample-note-meta {
    flex-basis: 100%;
    order: 1;
    font-size: 12px;
  }
  .back-label {
    display: block;
  }
  .sample-actions > .sample-primary,
  .sample-secondary-actions > span {
    min-height: 44px;
  }
}
</style>
