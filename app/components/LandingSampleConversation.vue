<script setup lang="ts">
const answer = `Use useFetch when your data comes from a URL.

It combines fetching with Nuxt’s async data handling. For custom async logic, use useAsyncData.

\`\`\`ts
const { data } = await useFetch('/api/notes')
\`\`\``;
</script>

<template>
  <div class="sample-conversation">
    <h3>Understanding useFetch</h3>
    <p class="sample-question">
      When should I use useFetch instead of useAsyncData?
    </p>
    <LandingMarkdownContent variant="chat" :content="answer" />
    <div class="sample-composer">
      <span />
      <span class="sample-send">
        <img src="/icons/chat-send.svg" width="20" height="20" alt="" />
      </span>
    </div>
  </div>
</template>

<style scoped>
.sample-conversation {
  --landing-code-size: 10px;
  --landing-code-radius: 4px;
  --landing-code-white-space: pre;
  --landing-code-wrap: normal;
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  padding: 16px 24px;
  gap: 16px;
}
.sample-conversation h3 {
  font-size: 18px;
  line-height: 1.35;
  font-weight: 600;
  margin-bottom: 8px;
}
.sample-question {
  align-self: flex-end;
  width: 70%;
  padding: 16px;
  background: var(--ui-bg-muted);
  border: 1px solid var(--ui-border);
  border-radius: 4px;
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
@media (min-width: 1280px) {
  .is-compact .sample-conversation {
    padding: 8px 12px;
    gap: 8px;
    --landing-code-size: 5px;
    --landing-code-padding: 8px;
  }
  .is-compact .sample-conversation h3 {
    font-size: 9px;
  }
  .is-compact .sample-question {
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
}
@media (min-width: 768px) and (max-width: 1279px) {
  .is-chat .sample-conversation {
    padding: 18px 30px;
    gap: 18px;
    --landing-code-size: 12px;
    --landing-code-padding: 18px;
  }
  .is-chat .sample-conversation h3 {
    font-size: 22px;
  }
  .is-chat .sample-question {
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
@media (max-width: 767px) {
  .is-chat .sample-conversation h3 {
    font-size: 22px;
  }
  .is-chat .sample-conversation {
    padding: 14px;
    gap: 18px;
    --landing-code-size: 11px;
    --landing-code-padding: 14px;
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
}
</style>
