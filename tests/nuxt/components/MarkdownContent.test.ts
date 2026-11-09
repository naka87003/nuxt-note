import { mountSuspended } from "@nuxt/test-utils/runtime";
import { flushPromises } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import MarkdownContent from "~/components/MarkdownContent.vue";
import LandingMarkdownContent from "~/components/LandingMarkdownContent.vue";

async function mountMarkdown(options: {
  props: { content: string; streaming?: boolean };
}) {
  const wrapper = await mountSuspended(MarkdownContent, options);
  await flushPromises();
  return wrapper;
}

describe("Markdown code copying", () => {
  it("uses standard Markdown line breaks and renders user HTML and component syntax as text", async () => {
    const wrapper = await mountMarkdown({
      props: {
        content:
          "First\nSecond  \nThird\n\n<script>alert(1)</script>\n<UButton>Unsafe</UButton>\n\n::alert\nText\n::\n\n![image](https://example.com/image.png)\n[x](javascript:alert(1))",
      },
    });
    expect(wrapper.findAll("br")).toHaveLength(1);
    expect(wrapper.find("script, img, button, alert").exists()).toBe(false);
    expect(wrapper.html()).not.toContain('href="javascript:');
    expect(wrapper.text()).toContain("<UButton>Unsafe</UButton>");
  });

  it("discards fence props and renders landing code without copy controls", async () => {
    const wrapper = await mountSuspended(LandingMarkdownContent, {
      props: {
        content:
          '```css [example.css] {copyable="true" onmouseover="alert(1)"}\na { color: red; }\n```',
      },
    });
    await flushPromises();
    expect(wrapper.find("pre code span").exists()).toBe(true);
    expect(
      wrapper.find("button, [onmouseover], [filename], [copyable]").exists(),
    ).toBe(false);
  });

  it("renders the latest streamed content and clears stale copy feedback", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    const wrapper = await mountMarkdown({
      props: { content: "```js\nconst a = 1;", streaming: true },
    });
    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(wrapper.get("button").attributes("data-state")).toBe("copied");
    await wrapper.setProps({ content: "```js\nconst a = 1;\nconst b = 2;" });
    await wrapper.setProps({
      content: "```js\nconst a = 1;\nconst b = 2;\n```\n\nFinished",
      streaming: false,
    });
    await flushPromises();
    expect(wrapper.get("pre code").text()).toBe("const a = 1;\nconst b = 2;");
    expect(wrapper.text()).toContain("Finished");
    expect(wrapper.get("button").attributes("data-state")).toBe("idle");
  });

  it("reveals the selected block on tap without copying or rendering a header", async () => {
    const writeText = vi.fn();
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const wrapper = await mountMarkdown({
      props: { content: "```css\na {}\n```\n\n```html\n<p>Hello</p>\n```" },
    });
    expect(wrapper.find(".code-block-toolbar").exists()).toBe(false);
    expect(wrapper.find(".code-language").exists()).toBe(false);
    const blocks = wrapper.findAll(".code-block");
    await blocks[0]!.get("pre").trigger("click");
    expect(blocks[0]!.classes()).toContain("code-block--active");
    await blocks[1]!.get("pre").trigger("click");
    expect(blocks[1]!.classes()).toContain("code-block--active");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("copies the parsed code, including internal whitespace and HTML, from the selected block", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const source =
      '<button title="test">& Hello &copy; &lt;script&gt;</button>\n  second line\n\n';
    const wrapper = await mountMarkdown({
      props: {
        content: `Inline \`code\`\n\n\`\`\`html\n${source}\`\`\`\n\n\`\`\`unknown\nother\n\`\`\``,
      },
    });
    expect(wrapper.findAll("button.code-copy")).toHaveLength(2);
    expect(wrapper.find("pre button").exists()).toBe(false);
    expect(wrapper.get("pre code").element.textContent).toBe(
      source.slice(0, -1),
    );
    await wrapper.get("button.code-copy span").trigger("click");
    await flushPromises();
    expect(writeText).toHaveBeenLastCalledWith(source.slice(0, -1));
    expect(wrapper.get("button.code-copy").attributes("data-state")).toBe(
      "copied",
    );
    expect(wrapper.findComponent({ name: "UIcon" }).exists()).toBe(true);
    expect(wrapper.get('[role="status"]').text()).toBe(
      "Code copied to clipboard.",
    );
    await wrapper.findAll("button.code-copy")[1]!.trigger("click");
    await flushPromises();
    expect(writeText).toHaveBeenLastCalledWith("other");
    expect(wrapper.find('button[title="test"]').exists()).toBe(false);
  });

  it.each(["rejected", "unavailable"])(
    "handles %s clipboard access and permits retry",
    async (mode) => {
      const writeText = vi.fn().mockRejectedValue(new Error("Denied"));
      vi.stubGlobal(
        "navigator",
        mode === "rejected" ? { clipboard: { writeText } } : {},
      );
      const wrapper = await mountMarkdown({
        props: { content: "    indented code\n" },
      });
      await wrapper.get("button").trigger("click");
      await flushPromises();
      expect(wrapper.get("button").attributes("data-state")).toBe("failed");
      expect(wrapper.get("button").attributes("disabled")).toBeUndefined();
      expect(wrapper.get('[role="status"]').text()).toContain(
        "copy it manually",
      );
      writeText.mockResolvedValue(undefined);
      vi.stubGlobal("navigator", { clipboard: { writeText } });
      await wrapper.get("button").trigger("click");
      await flushPromises();
      expect(writeText).toHaveBeenLastCalledWith("indented code");
      expect(wrapper.get("button").attributes("data-state")).toBe("copied");
    },
  );

  it("ignores completion for a block replaced during streaming", async () => {
    let finish!: () => void;
    const writeText = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const wrapper = await mountMarkdown({
      props: { content: "```js\nfirst" },
    });
    await wrapper.get("button").trigger("click");
    await wrapper.setProps({ content: "```js\nfirst + second\n```" });
    await flushPromises();
    finish();
    await flushPromises();
    expect(wrapper.get("button").attributes("data-state")).toBe("idle");
    expect(wrapper.get('[role="status"]').text()).toBe("");
    expect(writeText).toHaveBeenCalledWith("first");
  });
});
