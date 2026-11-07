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

const groups = ["Today", "Last 7 Days", "Last Month", "Older"];
const noteCount = computed(() =>
  interactive.value ? 23 + Number(!!props.savedCategory) : 24,
);
const listCount = computed(() =>
  props.savedCategory
    ? noteCount.value
    : isChat.value
      ? 4
      : categoryCount("Nuxt", 1),
);

function categoryCount(category: string, index: number): number {
  if (isChat.value) return [3, 4, 3][index]!;
  if (!interactive.value) return [8, 7, 6][index]!;
  return [8, 6, 6][index]! + Number(props.savedCategory === category);
}

const noteTitles = [
  "Nuxt data fetching",
  "Server routes and API",
  "Runtime config",
  "Nuxt UI components",
];

const chatTitles = [
  "Understanding useFetch",
  "Auth callback",
  "Custom composables",
  "SSR caching",
];

const summaries = computed(() =>
  isChat.value
    ? [
        "When to use useFetch and useAsyncData.",
        "Debugging a GitHub sign-in callback.",
        "Sharing reusable fetching logic.",
        "Keeping server responses fresh.",
      ]
    : [
        "When to use useFetch and useAsyncData.",
        "Connecting APIs with typed responses.",
        "Configuration and runtime settings.",
        "Choosing the right UI components.",
      ],
);

const visibleGroups = computed(() =>
  groups.flatMap((group, index) => {
    const saved = index === 0 && !!props.savedCategory;
    if (index === 0 && !isChat.value && interactive.value && !saved) return [];
    return [
      {
        group,
        selected: index === 0,
        title:
          index === 0 && props.previewTitle
            ? props.previewTitle
            : (isChat.value ? chatTitles : noteTitles)[index],
        summary: saved ? props.previewContent : summaries.value[index],
        category: saved ? props.savedCategory : "Nuxt",
        updated: saved
          ? "Just now"
          : ["Nov 3, 10:24", "Nov 2", "Oct 18", "Sep 14"][index],
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
    :aria-label="
      interactive
        ? 'Interactive demo: turn a conversation into a note'
        : noteDraft
          ? 'Example Chat workspace with a Generate note confirmation: AI organizes the conversation into a draft to review and edit before saving'
          : isChat
            ? 'Example Chat workspace with shared categories and a conversation about useFetch'
            : 'Example Notes workspace with categories, recent notes, and a Markdown note about Nuxt data fetching'
    "
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
          <UIcon name="i-lucide-menu" class="mobile-preview-menu" />
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
            v-for="(category, i) in ['English', 'Nuxt', 'TypeScript']"
            :key="category"
            class="category-link"
            :class="{ selected: !savedCategory && i === 1 }"
          >
            <UIcon name="i-lucide-folder" />
            {{ category }}
            <small>{{ categoryCount(category, i) }}</small>
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
              <strong class="break-words">{{ item.title }}</strong>
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
                      <span class="sample-category-prefix">Category:&nbsp;</span
                      >Nuxt
                    </template>
                    <template v-else>Edit</template>
                  </span>
                  <span class="sample-soft">Delete</span>
                </div>
              </div>
            </div>
            <div v-if="!isChat" class="sample-note">
              <h3>Nuxt data fetching</h3>
              <h4>Overview</h4>
              <p>
                Use useFetch for URL-based requests and useAsyncData for custom
                async logic. Keep these patterns handy while building your
                application.
              </p>
              <h4>useFetch</h4>
              <p>
                Fetch data from a URL with built-in support for SSR and
                hydration.
              </p>
              <pre><code><span class="syntax-keyword">const</span> { data } = <span class="syntax-keyword">await</span> <span class="syntax-function">useFetch</span>(<span class="syntax-string">'/api/notes'</span>)
<span class="syntax-comment">// Keep the response in your note</span></code></pre>
              <h4>Checklist</h4>
              <ul>
                <li>Define the response type</li>
                <li>Handle loading and errors</li>
                <li>Refresh when filters change</li>
              </ul>
              <blockquote>
                Keep each note focused so it is easy to revisit.
              </blockquote>
            </div>
            <div v-else class="sample-conversation">
              <h3>Understanding useFetch</h3>
              <p class="sample-question">
                When should I use useFetch instead of useAsyncData?
              </p>
              <p>Use useFetch when your data comes from a URL.</p>
              <p>
                It combines fetching with Nuxt’s async data handling. For custom
                async logic, use useAsyncData.
              </p>
              <pre><code><span class="syntax-keyword">const</span> { data } =
  <span class="syntax-keyword">await</span> <span class="syntax-function">useFetch</span>(<span class="syntax-string">'/api/notes'</span>)</code></pre>
              <div class="sample-composer">
                <span />
                <span class="sample-send">
                  <img
                    src="/icons/chat-send.svg"
                    width="20"
                    height="20"
                    alt=""
                  />
                </span>
              </div>
            </div>
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
  color: var(--ui-primary);
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
.sample-header {
  position: relative;
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
  gap: 8px;
  justify-content: space-between;
  align-items: center;
  min-height: 40px;
  padding: 6px 16px;
  border-bottom: 1px solid var(--ui-border);
}
.sample-toolbar > div {
  display: flex;
  gap: 8px;
  margin-left: auto;
}
.sample-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
  min-width: 0;
}
.sample-actions > .sample-primary,
.sample-secondary-actions > span {
  white-space: nowrap;
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
.sample-note {
  padding: 24px;
}
h3 {
  font-size: 22px;
  line-height: 1.35;
  font-weight: 600;
  margin-bottom: 8px;
}
h4 {
  font-weight: 600;
  font-size: 16px;
  margin-block: 24px 10px;
}
pre {
  padding: 16px;
  background: var(--ui-bg-muted);
  border-radius: 4px;
  font-size: 10px;
  margin-top: 16px;
  overflow: auto;
  white-space: pre;
}
.syntax-keyword {
  color: #f97583;
}
.syntax-function {
  color: #b392f0;
}
.syntax-string {
  color: #9ecbff;
}
.syntax-comment {
  color: #6a737d;
}
.sample-note ul {
  list-style: disc;
  padding-left: 16px;
}
blockquote {
  background: var(--ui-bg-muted);
  padding: 12px;
  margin-top: 16px;
}
.sample-conversation {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  padding: 16px 24px;
  gap: 16px;
}
.sample-conversation h3 {
  font-size: 18px;
}
.sample-question {
  align-self: flex-end;
  width: 70%;
  padding: 16px;
  background: var(--ui-bg-muted);
  border: 1px solid var(--ui-border);
  border-radius: 4px;
}
.sample-conversation pre {
  margin: 0;
}
.sample-composer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 48px;
  border: 1px solid var(--ui-border);
  border-radius: 29px;
  padding: 8px 12px;
  margin-top: auto;
}
.sample-send {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--ui-primary);
  opacity: 0.5;
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
    min-height: 20px;
    padding: 3px 8px;
  }
  .is-compact .sample-toolbar > div {
    gap: 4px;
  }
  .is-compact .sample-conversation {
    padding: 8px 12px;
    gap: 8px;
  }
  .is-compact .sample-conversation h3 {
    font-size: 9px;
  }
  .is-compact .sample-question {
    padding: 8px;
  }
  .is-compact pre {
    font-size: 5px;
    padding: 8px;
  }
  .is-compact .sample-composer {
    min-height: 22px;
    padding: 4px 5px;
  }
  .is-compact .sample-send {
    width: 13px;
    height: 13px;
  }
  .is-compact .sample-send img {
    width: 8px;
    height: 8px;
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
  .is-chat .sample-primary,
  .is-chat .sample-soft,
  .is-chat .sample-outline {
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
  .is-chat .sample-toolbar {
    min-height: 44px;
    padding: 6px 18px;
  }
  .is-chat .sample-conversation {
    padding: 18px 30px;
    gap: 18px;
  }
  .is-chat .sample-conversation h3 {
    font-size: 22px;
  }
  .is-chat .sample-question {
    padding: 18px;
  }
  .is-chat pre {
    font-size: 12px;
    padding: 18px;
  }
  .is-chat .sample-composer {
    min-height: 53px;
    padding: 10px 12px;
  }
  .is-chat .sample-send {
    width: 30px;
    height: 30px;
  }
  .is-chat .sample-send img {
    width: 19px;
    height: 19px;
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
    min-height: 54px;
    padding: 8px 14px;
    border: 0;
  }
  .back-label {
    display: block;
  }
  .sample-note-meta {
    flex-basis: 100%;
    order: 1;
    font-size: 12px;
  }
  .sample-note {
    padding: 14px;
  }
  h3,
  .is-chat .sample-conversation h3 {
    font-size: 22px;
  }
  pre {
    padding: 14px;
    font-size: 11px;
  }
  .sample-note pre {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .is-chat .sample-conversation {
    padding: 14px;
    gap: 18px;
  }
  .is-chat .sample-question {
    padding: 14px;
  }
  .is-chat .sample-composer {
    min-height: 52px;
    padding: 10px 12px;
  }
  .is-chat .sample-send {
    width: 29px;
    height: 29px;
  }
  .is-chat .sample-send img {
    width: 18px;
    height: 18px;
  }
  .is-chat .sample-actions > .sample-primary,
  .is-chat .sample-secondary-actions > .sample-soft {
    min-height: 44px;
    padding-inline: 6px;
  }
  .is-note-draft {
    border-radius: 8px;
  }
}
</style>
