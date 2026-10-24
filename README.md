# anti-ai-slop-design

A Claude skill that designs or redesigns a web page or web app so it looks and feels made by a person instead of generated. It works on a single HTML file or on a React / Next.js project.

It strips the obvious AI tells and the newer, more tasteful ones, then makes real decisions from the product itself: a concept, a first screen that shows evidence, real content, and type, colour and spacing chosen on purpose. Beyond the look, it covers UI components and libraries, motion, mobile feel, polish details, worst-case data and a review process, each in its own reference file that Claude reads only when it needs it. A small script takes phone and desktop screenshots and scans for mechanical problems.

It's the visual counterpart to Jalaal's anti-ai-slop-writing skill: same directive style, same refusal to accept the default output, aimed at how a product looks instead of how it reads.

**Use it in Claude Code (including claude.ai/code):**
```
Fetch the anti-ai-slop-design skill from github.com/jalaalrd/anti-ai-slop-design (the skills/anti-ai-slop-design folder) into .claude/skills in this repo, read its SKILL.md, and use it to redesign my app. Don't remove any features. Open a pull request when done.
```

**Use it on a single HTML file:**
```
Fetch the anti-ai-slop-design skill from raw.githubusercontent.com/jalaalrd/anti-ai-slop-design/main/skills/anti-ai-slop-design/SKILL.md, read it, and apply it to my HTML file.
```

By Jalaal.
