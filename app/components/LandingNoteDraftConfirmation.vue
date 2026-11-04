<template>
  <div class="sample-confirmation" aria-hidden="true">
    <div class="sample-dialog">
      <div class="sample-dialog-header">Create note from this chat?</div>
      <p class="sample-dialog-description">
        AI will organize this conversation into a draft. You can review and edit
        it before saving.
      </p>
      <div class="sample-dialog-actions">
        <span class="sample-dialog-cancel">Cancel</span>
        <span class="sample-primary">Create note</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sample-confirmation {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.sample-confirmation::before {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--ui-bg-elevated);
  opacity: 0.78;
}
.sample-dialog {
  position: relative;
  width: 397px;
  max-width: 100%;
  border: 1px solid var(--ui-border);
  border-radius: 6px;
  background: var(--ui-bg);
  color: var(--ui-text);
  overflow: hidden;
}
.sample-dialog-header {
  padding: 19px;
  border-bottom: 1px solid var(--ui-border);
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}
.sample-dialog-description {
  padding: 19px;
  border-bottom: 1px solid var(--ui-border);
  font-size: 13px;
  line-height: 19px;
}
.sample-dialog-actions {
  display: flex;
  gap: 6px;
  padding: 13px 19px;
}
.sample-dialog-actions > span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 35px;
  padding: 5px 8px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 700;
  line-height: 16px;
  white-space: nowrap;
}
.sample-dialog-cancel {
  width: 77px;
  border: 1px solid var(--ui-border-accented);
}
.sample-dialog-actions > .sample-primary {
  width: 102px;
}
.sample-primary {
  color: var(--ui-bg);
  background: var(--ui-primary);
}
@media (min-width: 768px) and (max-width: 1279px) {
  .sample-dialog-actions > .sample-primary {
    padding: 4px 12px;
    font-size: 12px;
  }
}
@media (max-width: 767px) {
  .sample-dialog {
    width: 326px;
  }
  .sample-dialog-header,
  .sample-dialog-description,
  .sample-dialog-actions {
    padding: 16px;
  }
  .sample-dialog-header {
    font-weight: 400;
  }
  .sample-dialog-description {
    font-size: 14px;
    line-height: 21px;
  }
  .sample-dialog-actions {
    gap: 8px;
  }
  .sample-dialog-actions > span {
    min-height: 44px;
    font-size: 14px;
    line-height: 20px;
  }
  .sample-dialog-actions > .sample-primary {
    width: 118px;
    padding: 5px 12px;
    font-size: 12px;
  }
}
</style>
