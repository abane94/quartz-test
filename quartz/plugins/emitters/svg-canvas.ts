import { QuartzEmitterPlugin } from "../types";
import { QuartzComponentProps } from "../../components/types";
import HeaderConstructor from "../../components/Header";
import BodyConstructor from "../../components/Body";
import { pageResources, renderPage } from "../../components/renderPage";
import {
  defaultProcessedContent,
  ProcessedContent,
  QuartzPluginData,
} from "../vfile";
import { FullPageLayout, GlobalConfiguration } from "../../cfg";
import {
  FilePath,
  FullSlug,
  getAllSegmentPrefixes,
  joinSegments,
  pathToRoot,
} from "../../util/path";
import {
  defaultListPageLayout,
  sharedPageComponents,
} from "../../../quartz.layout";
import { Content, TagContent } from "../../components";
import { write } from "./helpers";
import { i18n } from "../../i18n";
import DepGraph from "../../depgraph";
import { glob } from "../../util/glob";
import { h } from "preact";
import CanvasSVG from "../../components/CanvasSVG";
import fs from "fs";
import path from "path";
import { unescapeHTML } from "../../util/escape";

interface TagPageOptions extends FullPageLayout {
  sort?: (f1: QuartzPluginData, f2: QuartzPluginData) => number;
}

export const SvgCanvasPage: QuartzEmitterPlugin<Partial<TagPageOptions>> = (
  userOpts,
) => {
  const opts: FullPageLayout = {
    ...sharedPageComponents,
    ...defaultListPageLayout,
    // pageBody: TagContent({ sort: userOpts?.sort }),
    pageBody: CanvasSVG(),
    ...userOpts,
  };

  const {
    head: Head,
    header,
    beforeBody,
    pageBody,
    afterBody,
    left,
    right,
    footer: Footer,
  } = opts;
  const Header = HeaderConstructor();
  const Body = BodyConstructor();

  return {
    name: "SvgCanvasPage",
    getQuartzComponents() {
      return [
        Head,
        Header,
        Body,
        ...header,
        ...beforeBody,
        pageBody,
        ...afterBody,
        ...left,
        ...right,
        Footer,
      ];
    },
    async getDependencyGraph(ctx, content, _resources) {
      const graph = new DepGraph<FilePath>();

      for (const [_tree, file] of content) {
        const sourcePath = file.data.filePath!;
        const tags = (file.data.frontmatter?.tags ?? []).flatMap(
          getAllSegmentPrefixes,
        );
        // if the file has at least one tag, it is used in the tag index page
        if (tags.length > 0) {
          tags.push("index");
        }

        for (const tag of tags) {
          graph.addEdge(
            sourcePath,
            joinSegments(ctx.argv.output, "tags", tag + ".html") as FilePath,
          );
        }
      }

      return graph;
    },
    async emit(ctx, content, resources): Promise<FilePath[]> {
      // const cfg = ctx.cfg as any as GlobalConfiguration;
      const cfg = ctx.cfg.configuration;
      const allFiles = await glob(
        "**/*.canvas",
        ctx.argv.directory,
        cfg.ignorePatterns,
      );
      // const fps = allFiles.filter((fp) => fp.endsWith(".canvas")).sort();

      const fps: FilePath[] = [];

      // for (const canvasFile of allFiles) {
      //   // const content = canvasFile;
      //   const slug = canvasFile.replace(".canvas", "") as FullSlug;

      //   const fp = await write({
      //     ctx,
      //     content,
      //     slug,
      //     ext: ".html",
      //   });

      //   fps.push(fp);
      // }

      for (const canvasFile of allFiles) {
        const slug = canvasFile.replace(".canvas", "") as FullSlug;
        // const slug = joinSegments("tags", tag) as FullSlug;
        // const [tree, file] = tagDescriptions[tag];
        // const externalResources = { css: [], js: [] };
        const externalResources = pageResources(
          pathToRoot(slug),
          {},
          resources,
        );
        const canvasData = await fs.promises.readFile(
          path.join(ctx.argv.directory, canvasFile),
          "utf-8",
        );
        const svg = `
          <div id="convas-container">
            ${convertCanvasToSVG(JSON.parse(canvasData))}
          </div>
          <script>
            ${script}
          </script>
        `;
        // convertCanvasToSVG(JSON.parse(canvasData));
        const componentData: QuartzComponentProps = {
          ctx,
          fileData: {
            text: `page for ${canvasFile}\n${svg}`,
            slug,
            frontmatter: {
              title: (slug.split("/").pop() || "")?.replace(".canvas", ""),
            },
          },
          externalResources,
          cfg,
          children: [],
          tree: {
            type: "",
          },
          allFiles: [],
        };

        const content = renderPage(
          cfg,
          slug,
          componentData,
          opts,
          externalResources,
        );
        const fp = await write({
          ctx,
          content: unescapeHTML(content),
          slug,
          ext: ".html",
        });

        fps.push(fp);
      }
      return fps;
      // return [];
    },
  };
};

//#region Convert code
// The following was modified from https://janikvonrotz.ch/2023/06/07/convert-obsidian-canvas-to-svg/

function mapColor(color) {
  let colors = {
    0: "#7e7e7e",
    1: "#aa363d",
    2: "#a56c3a",
    3: "#aba960",
    4: "#199e5c",
    5: "#249391",
    6: "#795fac",
  };
  let appliedColor = colors[0];

  if (color && (0 < color.length < 2)) {
    appliedColor = colors[color];
  }
  if (color && (1 < color.length)) {
    appliedColor = color;
  }
  return appliedColor;
}

function renderNode(node) {
  const strockWidth = 4;
  const fontWeight = "bold";
  const fontFamily = "Roboto, Oxygen, Ubuntu, Cantarell, sans-serif";

  let textOffsetX = 15;
  let textOffsetY = 0;
  // let fontColor = "#2c2d2c";
  let fontColor = "var(---darkgray)";
  let fontSize = 15;
  let content = "";

  // Render default text

  if (node["text"]) {
    content = `
      <style>
          p {
              font-family: ${fontFamily};
              font-size: ${fontSize}px;
              color: ${fontColor};
          }
      </style>
      <foreignObject x="${node["x"] + textOffsetX}" y="${
      node["y"] + textOffsetY
    }" width="${node["width"] - textOffsetX * 2}" height="${
      node["height"] - textOffsetY * 2
    }">
      <p xmlns="http://www.w3.org/1999/xhtml" class="${node["id"]}">${
      node["text"]
    }</p>
      </foreignObject>
      `;
  }

  // Render multiline text

  if (node["text"] && node["text"].split("\n").length > 1) {
    let spans = "";
    for (const line of node["text"].split("\n")) {
      spans += `<tspan x="${node["x"] + textOffsetX}" dy="${
        fontSize + 3
      }">${line}</tspan>`;
    }
    textOffsetY = 10;
    content = `<text x="${node["x"] + textOffsetX}" y="${
      node["y"] + textOffsetY
    }" font-family="${fontFamily}" fill="${fontColor}">${spans}</text>`;
  }

  // Render linked markdown file

  if (node["file"] && node["file"].endsWith(".md")) {
    let title = node["file"].replace(".md", "");
    // let text = `<a href="/${title.toLowerCase()}.html">${title}</a>`
    let iframeLink = `/${title.toLowerCase().replace(/ /g, "-")}`;
    fontColor = "#9a7fee";
    fontSize = 28;
    textOffsetX = 30;
    textOffsetY = 45;
    // content = `<text x="${node['x'] + textOffsetX}" y="${node['y'] + textOffsetY}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}" fill="${fontColor}">${text}</text>`

    // x="${node["x"]}" y="${node["y"]}" width="${node["width"]}" height="${
    //   node["height"]
    // }"
    content = `
          <foreignobject x="${node["x"]}" y="${node["y"]}" width="${
      node["width"]
    }" height="${node["height"]}" >
              <iframe src=\"${iframeLink}\" style="width: 100%; height: 100%; border: 0;"></iframe>
          </foreignobject>
      `;
  }

  // Render image

  if (node["file"] && !node["file"].endsWith(".md")) {
    let filePath = node["file"];

    const base64_content = fs.readFileSync(
      path.join("content", filePath),
      "base64",
    );
    let extension = path.extname(filePath).replace(".", "");

    content =
      `<image href="${`data:image/${extension};base64,${base64_content}`}" x="${
        node["x"]
      }" y="${node["y"]}" width="${node["width"]}" height="${
        node["height"]
      }" clip-path="inset(0% round 15px)" />`;
    fontColor = "#9a7fee";
  }

  return `
  <rect x="${node["x"]}" y="${node["y"]}" width="${node["width"]}" height="${
    node["height"]
  }" rx="15" stroke="${
    mapColor(node["color"])
  }" stroke-width="${strockWidth}" fill="none"/>
  ${content}
  `;
}

function renderGroup(group) {
  const strockWidth = 4;
  const fontWeight = "bold";
  const fontFamily = "Roboto, Oxygen, Ubuntu, Cantarell, sans-serif";

  let textOffsetX = 15;
  let textOffsetY = -15;
  let fontColor = "#2c2d2c";
  let fillColor = "#fbfbfb";
  let text = group["label"];
  let fontSize = 24;

  return `
  <rect x="${group["x"]}" y="${group["y"]}" width="${group["width"]}" height="${
    group["height"]
  }" rx="30" stroke="${
    mapColor(group["color"])
  }" stroke-width="${strockWidth}" fill="${fillColor}"/>
  <text x="${group["x"] + textOffsetX}" y="${
    group["y"] + textOffsetY
  }" font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}" fill="${fontColor}">${text}</text>
  `;
}

function renderEdge(edge) {
  const id = edge["id"];
  const strockWidth = 5;
  const color = mapColor(edge["color"]);
  const fromSide = edge["fromSide"];
  const toSide = edge["toSide"];
  const fontFamily = "Roboto, Oxygen, Ubuntu, Cantarell, sans-serif";
  const fontColor = "#2c2d2c";

  let marker = `marker-end="url(#arrow-end-${id})"`;
  let fromOffset = 1;
  let toOffset = 11;
  let fromX = edge["fromX"];
  let fromY = edge["fromY"];
  let toX = edge["toX"];
  let toY = edge["toY"];
  let label = "";

  // Set arrow marker

  if (edge["fromEnd"] === "arrow") {
    marker =
      `marker-end="url(#arrow-end-${id})" marker-start="url(#arrow-start-${id})"`;
    fromOffset = 11;
  }
  if (edge["toEnd"] === "none") {
    marker = "";
    toOffset = 1;
  }

  // Calculate position with offset

  if (fromSide === "right") {
    fromX += fromOffset;
  }
  if (fromSide === "bottom") {
    fromY += fromOffset;
  }
  if (fromSide === "left") {
    fromX -= fromOffset;
  }
  if (fromSide === "top") {
    fromY -= fromOffset;
  }
  if (toSide === "right") {
    toX += toOffset;
  }
  if (toSide === "bottom") {
    toY += toOffset;
  }
  if (toSide === "left") {
    toX -= toOffset;
  }
  if (toSide === "top") {
    toY -= toOffset;
  }

  // Add label if is set

  if (edge["label"]) {
    // Calculate position with offset
    let labelLength = edge["label"].length * 4;
    let labelX = fromX - labelLength;
    let labelY = fromY;

    if (toX > fromX) {
      labelX += Math.abs((fromX - toX) / 2);
    }
    if (toY > fromY) {
      labelY += Math.abs((fromY - toY) / 2);
    }
    if (toX < fromX) {
      labelX -= Math.abs((toX - fromY) / 2);
    }
    if (toY < fromY) {
      labelY -= Math.abs((toY - fromY) / 2);
    }

    label =
      content =
        `<text x="${labelX}" y="${labelY}" font-family="${fontFamily}" fill="${fontColor}">${
          edge["label"]
        }</text>`;
  }

  return `
  <marker xmlns="http://www.w3.org/2000/svg" id="arrow-end-${id}" viewBox="0 0 10 10" refX="1" refY="5" fill="${color}" markerUnits="strokeWidth" markerWidth="3" markerHeight="3" orient="auto">
      <path d="M 0 0 L 7 5 L 0 10 z"/>
  </marker>
  <marker xmlns="http://www.w3.org/2000/svg" id="arrow-start-${id}" viewBox="-10 -10 10 10" refX="-1" refY="-5" fill="${color}" markerUnits="strokeWidth" markerWidth="3" markerHeight="3" orient="auto">
      <path d="M 0 0 L -7 -5 L -0 -10 z"/>
  </marker>
  <line x1="${fromX}" y1="${fromY}" x2="${toX}" y2="${toY}" stroke="${color}" stroke-width="${strockWidth}" ${marker} />
  ${label}
  `;
}

function convertCanvasToSVG(content) {
  let nodes = content["nodes"];
  let edges = content["edges"];

  let svg = "";
  // svg += '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n';
  // svg +=
  //   '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n';

  // Calculate view box position

  let minX = 0;
  let minY = 0;

  for (const node of nodes) {
    let nodeX = node["x"];
    let nodeY = node["y"];
    let nodeWith = node["width"];
    let nodeHeight = node["height"];

    if (nodeX < minX) {
      minX = nodeX;
    }
    if (nodeY < minY) {
      minY = nodeY;
    }
  }

  // Caclulate view box size

  let width = 0;
  let height = 0;

  for (const node of nodes) {
    let nodeX = node["x"];
    let nodeY = node["y"];
    let nodeWith = node["width"];
    let nodeHeight = node["height"];

    let nodeMaxX = Math.abs(nodeX - minX) + nodeWith;
    if (width < nodeMaxX) {
      width = nodeMaxX;
    }
    let nodeMaxY = Math.abs(nodeY - minY) + nodeHeight;
    if (height < nodeMaxY) {
      height = nodeMaxY;
    }
  }

  // Add view box

  const spacing = 50;

  svg += `<svg id="svg-canvas" viewBox="${minX - spacing} ${minY - spacing} ${
    width + spacing * 2
  } ${height + spacing * 2}" xmlns="http://www.w3.org/2000/svg">\n`;

  // Render group as rect

  for (const group of nodes.filter((node) => (node["type"] === "group"))) {
    svg += renderGroup(group);
  }

  for (const edge of edges) {
    const fromSide = edge["fromSide"];
    const toSide = edge["toSide"];
    let fromX = 0;
    let fromY = 0;
    let toX = 0;
    let toY = 0;

    // Get start and target nodes

    let fromNode = nodes.filter((node) => (node["id"] === edge["fromNode"]))[0];
    let toNode = nodes.filter((node) => (node["id"] === edge["toNode"]))[0];

    // Calculate x and y position of arrow start

    if (fromSide === "right") {
      fromX = fromNode["x"] + fromNode["width"];
      fromY = fromNode["y"] + fromNode["height"] / 2;
    }
    if (fromSide === "bottom") {
      fromX = fromNode["x"] + fromNode["width"] / 2;
      fromY = fromNode["y"] + fromNode["height"];
    }
    if (fromSide === "left") {
      fromX = fromNode["x"];
      fromY = fromNode["y"] + fromNode["height"] / 2;
    }
    if (fromSide === "top") {
      fromX = fromNode["x"] + fromNode["width"] / 2;
      fromY = fromNode["y"];
    }
    edge["fromX"] = fromX;
    edge["fromY"] = fromY;

    // Calculate x and y position of arrow target

    if (toSide === "right") {
      toX = toNode["x"] + toNode["width"];
      toY = toNode["y"] + toNode["height"] / 2;
    }
    if (toSide === "bottom") {
      toX = toNode["x"] + toNode["width"] / 2;
      toY = toNode["y"] + toNode["height"];
    }
    if (toSide === "left") {
      toX = toNode["x"];
      toY = toNode["y"] + toNode["height"] / 2;
    }
    if (toSide === "top") {
      toX = toNode["x"] + toNode["width"] / 2;
      toY = toNode["y"];
    }
    edge["toX"] = toX;
    edge["toY"] = toY;

    svg += renderEdge(edge);
  }

  // Render nodes as rect

  for (
    const node of nodes.filter(
      (node) => (["text", "file"].includes(node["type"])),
    )
  ) {
    svg += renderNode(node);
  }

  svg += "</svg>";

  return svg;
}
//#endregion

const script = `
const svg = document.getElementById('svg-canvas');
  const container = document.getElementById('convas-container');
  let zoomLevel = 1;
  let panX = 0;
  let panY = 0;
  let isDragging = false;
  let startX, startY;

  function applyTransform() {
    svg.style.transform = \`translate(\${panX}px, \${panY}px) scale(\${zoomLevel})\`;
  }

  container.addEventListener('wheel', (e) => {
    e.preventDefault(); // Prevent page scrolling
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1; // Zoom out or in
    zoomLevel *= zoomFactor;
    applyTransform();
  });

  container.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
    container.style.cursor = 'grabbing';
  });

  container.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    applyTransform();
  });

  container.addEventListener('mouseup', () => {
    isDragging = false;
    container.style.cursor = 'default';
  });

  container.addEventListener('mouseleave', () => {
    isDragging = false;
    container.style.cursor = 'default';
  });

`;
