# anti-ai-slop-design

A Claude skill that redesigns a web page or web app you've already built so it stops looking like every other AI-generated product. It works on a single HTML file or on a React / Next.js project.

It strips the obvious tells (purple gradients, emoji icons, identical three-card grids) and the newer, more tasteful ones: the warm-paper page with an italic accent word and a "New" pill, and the dashboard that opens on a row of metric cards. In their place it makes real decisions from the product itself: a concept, a first screen that shows evidence, real content, and type, colour and spacing rules applied on purpose. Then it checks the result still works on a phone and that no feature was lost.

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
