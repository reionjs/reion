"use client";
import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock";
import {
  CodeBlockTab,
  CodeBlockTabs,
  CodeBlockTabsList,
  CodeBlockTabsTrigger,
} from "fumadocs-ui/components/codeblock";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import { useState } from "react";
import { CodeFileTab, PROJECT_TABS } from "@/lib/code-examples";

function EditorCodePanel({ files }: { files: readonly CodeFileTab[] }) {
  const [language, setLanguage] = useState<"ts" | "js">("ts");
  return (
    <CodeBlockTabs
      defaultValue={files[0].id}
      className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/70"
    >
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-900/60 px-2 py-1.5">
        <CodeBlockTabsList className="bg-transparent p-0">
          {files.map((file) => (
            <CodeBlockTabsTrigger
              key={file.id}
              value={file.id}
              className="inline-flex items-center gap-2 rounded-md border-0 px-2.5 py-1 text-xs font-medium text-zinc-400 transition-colors data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100"
            >
              {language === "ts" ? file.labelTs : file.labelJs}
            </CodeBlockTabsTrigger>
          ))}
        </CodeBlockTabsList>

        <ToggleGroup
          variant={"outline"}
          value={[language]}
          onValueChange={(value: readonly string[]) => {
            if (value.includes("ts") && value.includes("js")) setLanguage("ts");
            else if (value.includes("ts")) setLanguage("ts");
            else if (value.includes("js")) setLanguage("js");
          }}
        >
          <ToggleGroupItem value="ts" aria-label="TS" className={"rounded-l-md!"}>
            TS
          </ToggleGroupItem>
          <ToggleGroupItem value="js" aria-label="JS" className={"rounded-r-md!"}>
            JS
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {files.map((file) => (
        <CodeBlockTab key={file.id} value={file.id} className="w-full">
          <DynamicCodeBlock
            code={file.code[language]}
            lang={language}
            codeblock={{
              className:
                "my-0 rounded-none border-0 bg-zinc-950 [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_code]:whitespace-pre-wrap [&_pre]:w-full",
              "data-line-numbers": true,
            }}
          />
        </CodeBlockTab>
      ))}
    </CodeBlockTabs>
  );
}

export function CodeExamplesSection() {
  return (
    <section className="w-full px-4 py-16 sm:px-6 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 text-center md:mb-14">
          <p className="text-primary text-sm font-medium tracking-wide uppercase">
            Code examples
          </p>
          <h2 className="text-foreground mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Clean APIs, typed responses, and secure defaults
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-base sm:text-lg">
            Build routes and configure your app with readable, strongly-typed
            code.
          </p>
        </div>

        <CodeBlockTabs
          defaultValue={PROJECT_TABS[0].id}
          className="overflow-hidden rounded-2xl border border-zinc-800 bg-linear-to-b from-zinc-950 to-zinc-900 shadow-2xl"
        >
          <div className="flex flex-wrap items-center gap-1 border-b border-zinc-800/90 bg-zinc-950/80 px-2 py-2">
            <CodeBlockTabsList className="bg-transparent p-0 no-scrollbar">
              {PROJECT_TABS.map((tab) => (
                <CodeBlockTabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="inline-flex items-center gap-2 rounded-md border-0 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100"
                >
                  <tab.icon className="size-3.5" />
                  {tab.label}
                </CodeBlockTabsTrigger>
              ))}
            </CodeBlockTabsList>
          </div>

          <div className="grid lg:grid-cols-[0.9fr_1.4fr]">
            <aside className="border-b border-zinc-800/90 p-6 lg:border-r lg:border-b-0">
              {PROJECT_TABS.map((tab) => (
                <CodeBlockTab key={tab.id} value={tab.id}>
                  <h3 className="text-2xl font-semibold tracking-tight text-zinc-100">
                    {tab.title}
                  </h3>
                  <p className="mt-4 text-sm leading-relaxed text-zinc-400">
                    {tab.description}
                  </p>
                  <div className="mt-6">
                    <a
                      href="/docs"
                      className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-100 transition-colors hover:bg-zinc-800"
                    >
                      Read docs
                    </a>
                  </div>
                  <div className="border-primary/60 bg-primary/10 mt-6 rounded-lg border-l-2 p-3">
                    <p className="text-xs leading-relaxed text-zinc-300">
                      {tab.hint}
                    </p>
                  </div>
                </CodeBlockTab>
              ))}
            </aside>

            <div className="p-4 md:p-6">
              {PROJECT_TABS.map((tab) => (
                <CodeBlockTab key={tab.id} value={tab.id}>
                  <EditorCodePanel files={tab.codeFiles} />
                </CodeBlockTab>
              ))}
            </div>
          </div>
        </CodeBlockTabs>
      </div>
    </section>
  );
}
