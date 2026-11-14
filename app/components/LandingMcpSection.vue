<template>
  <section id="mcp" class="mcp-section" aria-labelledby="mcp-title">
    <div class="mcp-copy">
      <p class="eyebrow">YOUR NOTES, BEYOND THE NOTEBOOK</p>
      <h2 id="mcp-title">Your notes, in your AI workflow.</h2>
      <p class="description">
        Connect a compatible AI agent to search, read, create, and update your
        notes through MCP.
      </p>
      <ul class="use-cases">
        <li>Search past ideas while working on a task.</li>
        <li>Save a useful explanation for later.</li>
        <li>Keep an existing note up to date.</li>
      </ul>
      <UButton
        to="/settings/agent-access"
        color="neutral"
        variant="outline"
        class="agent-link"
      >
        Explore agent access
      </UButton>
      <p class="small-copy">
        Connect from Profile → Agent access.<br />
        Requires a compatible MCP client and an access token.
      </p>
    </div>
    <figure class="agent-example" aria-label="Illustrative MCP workflow">
      <p class="eyebrow">CONNECTED AI AGENT</p>
      <blockquote>
        “Find my Nuxt notes and help me choose a data-fetching approach.”
      </blockquote>
      <ol class="agent-steps">
        <li><span>01</span>Search saved notes</li>
        <li><span>02</span>Read relevant notes</li>
        <li><span>03</span>Use them in the answer</li>
      </ol>
      <div class="note-reference">
        <h3>Nuxt data fetching</h3>
        <p>
          Your saved patterns, examples, and decisions — ready to use in the
          task at hand.
        </p>
      </div>
      <figcaption class="small-copy">
        Illustrative workflow · Connection setup required
      </figcaption>
    </figure>
  </section>
</template>

<style scoped>
.mcp-section {
  display: grid;
  grid-template-columns: minmax(0, 488fr) minmax(0, 536fr);
  align-items: center;
  gap: 48px;
  padding: 40px;
  background: var(--ui-bg-muted);
  border: 1px solid var(--ui-border);
  border-radius: 24px;
  scroll-margin-top: 24px;
}
.mcp-copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 20px;
  min-width: 0;
}
.eyebrow {
  color: var(--ui-primary);
  font-size: 12px;
  font-weight: 600;
  line-height: 19px;
}
h2 {
  color: var(--ui-text-highlighted);
  font-size: 40px;
  font-weight: 700;
  line-height: 1.55;
  text-wrap: balance;
}
.description {
  color: var(--ui-text-dimmed);
  font-size: 18px;
  line-height: 28px;
}
.use-cases {
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 16px;
  line-height: 25px;
}
.agent-link {
  min-height: 44px;
  width: 204px;
  max-width: 100%;
  justify-content: center;
  font-weight: 700;
}
.small-copy {
  color: var(--ui-text-dimmed);
  font-size: 12px;
  line-height: 19px;
}
.agent-example {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
  padding: 24px;
  background: var(--ui-bg);
  border: 1px solid var(--ui-border);
  border-radius: 16px;
}
blockquote {
  color: var(--ui-text-highlighted);
  font-size: 20px;
  line-height: 31px;
  font-weight: 600;
}
.agent-steps,
.note-reference {
  padding: 16px;
  border: 1px solid var(--ui-border);
  border-radius: 12px;
}
.agent-steps {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--ui-bg-muted);
  color: var(--ui-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
}
.agent-steps li {
  display: flex;
  gap: 16px;
}
.note-reference {
  background: var(--ui-bg-elevated);
}
.note-reference h3 {
  color: var(--ui-text-highlighted);
  font-size: 18px;
  font-weight: 600;
  line-height: 28px;
  margin-bottom: 8px;
}
.note-reference p {
  color: var(--ui-text-dimmed);
  font-size: 14px;
  line-height: 22px;
}
@media (max-width: 1279px) {
  .mcp-section {
    grid-template-columns: minmax(0, 1fr);
    gap: 32px;
  }
}
@media (max-width: 1023px) {
  .mcp-section {
    padding: 32px;
  }
}
@media (max-width: 767px) {
  .mcp-section {
    padding: 24px;
    gap: 24px;
    border-radius: 16px;
  }
  h2 {
    font-size: 30px;
    line-height: 38px;
    text-wrap: wrap;
  }
  .description {
    font-size: 16px;
    line-height: 25px;
  }
  .agent-example {
    padding: 16px;
  }
  blockquote,
  .note-reference h3 {
    font-size: 16px;
    line-height: 25px;
  }
}
</style>
