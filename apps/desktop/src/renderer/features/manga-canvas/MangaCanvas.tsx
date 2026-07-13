import React from "react";
import {
  Ellipse,
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
  Transformer,
} from "react-konva";
import type {
  Balloon,
  Page,
  Panel,
  ProjectBundle,
  TextObject,
} from "@mangai/project-core";
import {
  applyPageTemplate,
  computeImagePlacement,
  constrainRectToPage,
  layoutVerticalText,
  pageTemplates,
  segmentGraphemes,
  snapRectToGuides,
  type PageTemplateId,
} from "@mangai/canvas-core";

type Selection = { type: "panel" | "balloon" | "text"; id: string } | null;
type LayerItem =
  | (Panel & { objectType: "panel" })
  | (Balloon & { objectType: "balloon" })
  | (TextObject & { objectType: "text" });

function useImage(source?: string) {
  const [image, setImage] = React.useState<HTMLImageElement>();
  React.useEffect(() => {
    if (!source) return setImage(undefined);
    const next = new Image();
    next.onload = () => setImage(next);
    next.src = source;
    return () => {
      next.onload = null;
    };
  }, [source]);
  return image;
}

function panelInput(panel: Panel) {
  return {
    id: panel.id,
    pageId: panel.pageId,
    name: panel.name,
    x: panel.x,
    y: panel.y,
    width: panel.width,
    height: panel.height,
    rotation: panel.rotation,
    zIndex: panel.zIndex,
    visible: panel.visible,
    locked: panel.locked,
    borderColor: panel.borderColor,
    borderWidth: panel.borderWidth,
    fillColor: panel.fillColor,
    imageAssetId: panel.imageAssetId,
    imageFit: panel.imageFit,
    imageOffsetX: panel.imageOffsetX,
    imageOffsetY: panel.imageOffsetY,
    imageScale: panel.imageScale,
    imageRotation: panel.imageRotation,
    imageOpacity: panel.imageOpacity,
  };
}
function balloonInput({
  createdAt: _createdAt,
  updatedAt: _updatedAt,
  ...item
}: Balloon) {
  void _createdAt;
  void _updatedAt;
  return item;
}
function textInput({
  createdAt: _createdAt,
  updatedAt: _updatedAt,
  ...item
}: TextObject) {
  void _createdAt;
  void _updatedAt;
  return item;
}

function PanelNode({
  panel,
  imageUrl,
  selected,
  onSelect,
  onMove,
  onSave,
}: {
  panel: Panel;
  imageUrl?: string;
  selected: boolean;
  onSelect: (node: any) => void;
  onMove?: (rect: { x: number; y: number; width: number; height: number }) => {
    x: number;
    y: number;
  };
  onSave: (value: Panel) => void;
}) {
  const image = useImage(imageUrl);
  if (!panel.visible) return null;
  const placement = image
    ? computeImagePlacement(
        { width: image.naturalWidth, height: image.naturalHeight },
        { x: 0, y: 0, width: panel.width, height: panel.height },
        {
          fit: panel.imageFit,
          scale: panel.imageScale,
          offsetX: panel.imageOffsetX,
          offsetY: panel.imageOffsetY,
        },
      )
    : null;
  return (
    <Group
      id={`panel-${panel.id}`}
      x={panel.x}
      y={panel.y}
      width={panel.width}
      height={panel.height}
      rotation={panel.rotation}
      draggable={!panel.locked}
      onClick={(event) => onSelect(event.currentTarget)}
      onTap={(event) => onSelect(event.currentTarget)}
      onDragMove={(event) => {
        if (!onMove) return;
        const next = onMove({
          x: event.target.x(),
          y: event.target.y(),
          width: panel.width,
          height: panel.height,
        });
        event.target.position(next);
      }}
      onDragEnd={(event) =>
        onSave({ ...panel, x: event.target.x(), y: event.target.y() })
      }
      onTransformEnd={(event) => {
        const node = event.target;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        onSave({
          ...panel,
          x: node.x(),
          y: node.y(),
          width: Math.max(20, panel.width * scaleX),
          height: Math.max(20, panel.height * scaleY),
          rotation: node.rotation(),
        });
      }}
    >
      <Rect width={panel.width} height={panel.height} fill={panel.fillColor} />
      {image && placement && (
        <Group
          clipX={0}
          clipY={0}
          clipWidth={panel.width}
          clipHeight={panel.height}
        >
          <KonvaImage
            image={image}
            x={placement.x}
            y={placement.y}
            width={placement.width}
            height={placement.height}
            rotation={panel.imageRotation}
            opacity={panel.imageOpacity}
            listening={false}
          />
        </Group>
      )}
      <Rect
        width={panel.width}
        height={panel.height}
        stroke={selected ? "#2f9e68" : panel.borderColor}
        strokeWidth={
          selected ? Math.max(panel.borderWidth, 7) : panel.borderWidth
        }
      />
    </Group>
  );
}

function BalloonNode({
  balloon,
  onSelect,
  onMove,
  onSave,
}: {
  balloon: Balloon;
  onSelect: (node: any) => void;
  onMove?: (rect: { x: number; y: number; width: number; height: number }) => {
    x: number;
    y: number;
  };
  onSave: (value: Balloon) => void;
}) {
  if (!balloon.visible) return null;
  const Shape = balloon.type === "speech_ellipse" ? Ellipse : Rect;
  const centered = balloon.type === "speech_ellipse";
  const tail = balloonTailPoints(balloon);
  return (
    <Group
      x={balloon.x}
      y={balloon.y}
      width={balloon.width}
      height={balloon.height}
      rotation={balloon.rotation}
      draggable={!balloon.locked}
      onClick={(event) => onSelect(event.currentTarget)}
      onTap={(event) => onSelect(event.currentTarget)}
      onDragMove={(event) => {
        if (!onMove) return;
        const next = onMove({
          x: event.target.x(),
          y: event.target.y(),
          width: balloon.width,
          height: balloon.height,
        });
        event.target.position(next);
      }}
      onDragEnd={(event) =>
        onSave({
          ...balloon,
          x: event.target.x(),
          y: event.target.y(),
        })
      }
      onTransformEnd={(event) => {
        const node = event.target;
        const width = Math.max(20, node.width() * node.scaleX());
        const height = Math.max(20, node.height() * node.scaleY());
        node.scaleX(1);
        node.scaleY(1);
        onSave({
          ...balloon,
          x: node.x(),
          y: node.y(),
          width,
          height,
          rotation: node.rotation(),
        });
      }}
    >
      {tail.length > 0 && (
        <Line
          points={tail}
          closed
          fill={balloon.fillColor}
          stroke={balloon.strokeColor}
          strokeWidth={balloon.strokeWidth}
          opacity={balloon.opacity}
        />
      )}
      <Shape
        x={centered ? balloon.width / 2 : 0}
        y={centered ? balloon.height / 2 : 0}
        width={balloon.width}
        height={balloon.height}
        radiusX={balloon.width / 2}
        radiusY={balloon.height / 2}
        cornerRadius={balloon.type === "speech_rounded" ? 30 : 0}
        fill={balloon.fillColor}
        stroke={balloon.strokeColor}
        strokeWidth={balloon.strokeWidth}
        opacity={balloon.opacity}
      />
    </Group>
  );
}

function balloonTailPoints(balloon: Balloon) {
  if (balloon.tailDirection === "none") return [];
  const width = balloon.width;
  const height = balloon.height;
  const offset = balloon.tailOffset;
  const horizontal = width * offset;
  const vertical = height * offset;
  const base = Math.max(12, Math.min(width, height) * 0.08);
  const length = Math.max(30, Math.min(width, height) * 0.3);
  switch (balloon.tailDirection) {
    case "top":
      return [horizontal - base, 0, horizontal, -length, horizontal + base, 0];
    case "top_right":
      return [width - base, 0, width + length, -length, width, base];
    case "right":
      return [
        width,
        vertical - base,
        width + length,
        vertical,
        width,
        vertical + base,
      ];
    case "bottom_right":
      return [
        width,
        height - base,
        width + length,
        height + length,
        width - base,
        height,
      ];
    case "bottom":
      return [
        horizontal - base,
        height,
        horizontal,
        height + length,
        horizontal + base,
        height,
      ];
    case "bottom_left":
      return [base, height, -length, height + length, 0, height - base];
    case "left":
      return [0, vertical - base, -length, vertical, 0, vertical + base];
    case "top_left":
      return [0, base, -length, -length, base, 0];
  }
}

function TextNode({
  item,
  onSelect,
  onMove,
  onSave,
}: {
  item: TextObject;
  onSelect: (node: any) => void;
  onMove?: (rect: { x: number; y: number; width: number; height: number }) => {
    x: number;
    y: number;
  };
  onSave: (value: TextObject) => void;
}) {
  if (!item.visible) return null;
  return (
    <Text
      x={item.x}
      y={item.y}
      width={item.width}
      height={item.height}
      text={
        item.writingMode === "vertical"
          ? segmentGraphemes(item.text).join("\n")
          : item.text
      }
      fontFamily={item.fontFamily}
      fontSize={item.fontSize}
      fontStyle={item.fontWeight >= 600 ? "bold" : "normal"}
      fill={item.color}
      align={
        item.textAlign === "start"
          ? "left"
          : item.textAlign === "end"
            ? "right"
            : "center"
      }
      verticalAlign={item.verticalAlign}
      lineHeight={item.lineHeight}
      letterSpacing={item.letterSpacing}
      padding={item.padding}
      opacity={item.opacity}
      rotation={item.rotation}
      draggable={!item.locked}
      onClick={(event) => onSelect(event.target)}
      onTap={(event) => onSelect(event.target)}
      onDragMove={(event) => {
        if (!onMove) return;
        const next = onMove({
          x: event.target.x(),
          y: event.target.y(),
          width: item.width,
          height: item.height,
        });
        event.target.position(next);
      }}
      onDragEnd={(event) =>
        onSave({ ...item, x: event.target.x(), y: event.target.y() })
      }
      onTransformEnd={(event) => {
        const node = event.target;
        const width = Math.max(20, node.width() * node.scaleX());
        const height = Math.max(20, node.height() * node.scaleY());
        node.scaleX(1);
        node.scaleY(1);
        onSave({
          ...item,
          x: node.x(),
          y: node.y(),
          width,
          height,
          rotation: node.rotation(),
        });
      }}
    />
  );
}

function DebouncedTextArea({
  initialValue,
  onCommit,
}: {
  initialValue: string;
  onCommit: (value: string) => void;
}) {
  const [value, setValue] = React.useState(initialValue);
  const commitRef = React.useRef(onCommit);
  commitRef.current = onCommit;
  React.useEffect(() => setValue(initialValue), [initialValue]);
  React.useEffect(() => {
    if (value === initialValue) return;
    const timer = window.setTimeout(() => commitRef.current(value), 600);
    return () => window.clearTimeout(timer);
  }, [value, initialValue]);
  return (
    <textarea
      value={value}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}

function CanvasProperties({
  item,
  balloons,
  savePanel,
  saveBalloon,
  saveText,
}: {
  item: LayerItem;
  balloons: Balloon[];
  savePanel: (item: Panel) => void;
  saveBalloon: (item: Balloon) => void;
  saveText: (item: TextObject) => void;
}) {
  const textOverflow =
    item.objectType === "text" &&
    (item.writingMode === "vertical"
      ? layoutVerticalText(item.text, item, {
          fontSize: item.fontSize,
          lineHeight: item.lineHeight,
          letterSpacing: item.letterSpacing,
        }).overflow
      : item.text.length * item.fontSize * item.fontSize * item.lineHeight >
        item.width * item.height);
  const saveName = (name: string) => {
    if (!name.trim() || name === item.name) return;
    if (item.objectType === "panel") savePanel({ ...item, name });
    else if (item.objectType === "balloon") saveBalloon({ ...item, name });
    else saveText({ ...item, name });
  };
  return (
    <div className="canvas-properties" key={`${item.objectType}-${item.id}`}>
      <h3>選択中のプロパティ</h3>
      <label>
        名前
        <input
          defaultValue={item.name}
          onBlur={(event) => saveName(event.target.value)}
        />
      </label>
      {item.objectType === "panel" && (
        <>
          <label>
            画像表示
            <select
              value={item.imageFit}
              onChange={(event) =>
                savePanel({
                  ...item,
                  imageFit: event.target.value as Panel["imageFit"],
                })
              }
            >
              <option value="cover">枠を覆う</option>
              <option value="contain">全体を表示</option>
              <option value="manual">手動</option>
            </select>
          </label>
          <label>
            画像倍率
            <input
              type="number"
              min="0.01"
              max="100"
              step="0.05"
              defaultValue={item.imageScale}
              onBlur={(event) =>
                savePanel({ ...item, imageScale: Number(event.target.value) })
              }
            />
          </label>
          <label>
            横オフセット
            <input
              type="number"
              defaultValue={item.imageOffsetX}
              onBlur={(event) =>
                savePanel({ ...item, imageOffsetX: Number(event.target.value) })
              }
            />
          </label>
          <label>
            縦オフセット
            <input
              type="number"
              defaultValue={item.imageOffsetY}
              onBlur={(event) =>
                savePanel({ ...item, imageOffsetY: Number(event.target.value) })
              }
            />
          </label>
          <label>
            画像回転
            <input
              type="number"
              step="1"
              defaultValue={item.imageRotation}
              onBlur={(event) =>
                savePanel({
                  ...item,
                  imageRotation: Number(event.target.value),
                })
              }
            />
          </label>
          <label>
            画像透明度
            <input
              type="number"
              min="0"
              max="1"
              step="0.05"
              defaultValue={item.imageOpacity}
              onBlur={(event) =>
                savePanel({ ...item, imageOpacity: Number(event.target.value) })
              }
            />
          </label>
          {item.imageAssetId && (
            <button
              className="secondary"
              onClick={() => savePanel({ ...item, imageAssetId: null })}
            >
              画像を外す
            </button>
          )}
        </>
      )}
      {item.objectType === "balloon" && (
        <>
          <label>
            種類
            <select
              value={item.type}
              onChange={(event) =>
                saveBalloon({
                  ...item,
                  type: event.target.value as Balloon["type"],
                })
              }
            >
              <option value="speech_ellipse">楕円</option>
              <option value="speech_rounded">角丸</option>
              <option value="narration_box">ナレーション</option>
            </select>
          </label>
          <label>
            尻尾
            <select
              value={item.tailDirection}
              onChange={(event) =>
                saveBalloon({
                  ...item,
                  tailDirection: event.target.value as Balloon["tailDirection"],
                })
              }
            >
              <option value="none">なし</option>
              <option value="top">上</option>
              <option value="top_right">右上</option>
              <option value="right">右</option>
              <option value="bottom_right">右下</option>
              <option value="bottom">下</option>
              <option value="bottom_left">左下</option>
              <option value="left">左</option>
              <option value="top_left">左上</option>
            </select>
          </label>
          <label>
            塗り色
            <input
              type="color"
              value={item.fillColor}
              onChange={(event) =>
                saveBalloon({ ...item, fillColor: event.target.value })
              }
            />
          </label>
          <label>
            線色
            <input
              type="color"
              value={item.strokeColor}
              onChange={(event) =>
                saveBalloon({ ...item, strokeColor: event.target.value })
              }
            />
          </label>
          <label>
            線幅
            <input
              type="number"
              min="0"
              defaultValue={item.strokeWidth}
              onBlur={(event) =>
                saveBalloon({
                  ...item,
                  strokeWidth: Number(event.target.value),
                })
              }
            />
          </label>
        </>
      )}
      {item.objectType === "text" && (
        <>
          {textOverflow && (
            <p className="canvas-warning">
              文字が枠からあふれる可能性があります。
            </p>
          )}
          <label>
            本文
            <DebouncedTextArea
              initialValue={item.text}
              onCommit={(text) => saveText({ ...item, text })}
            />
          </label>
          <label>
            親の吹き出し
            <select
              value={item.parentBalloonId ?? ""}
              onChange={(event) =>
                saveText({
                  ...item,
                  parentBalloonId: event.target.value || null,
                })
              }
            >
              <option value="">なし（自由テキスト）</option>
              {balloons.map((balloon) => (
                <option key={balloon.id} value={balloon.id}>
                  {balloon.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            組方向
            <select
              value={item.writingMode}
              onChange={(event) =>
                saveText({
                  ...item,
                  writingMode: event.target.value as TextObject["writingMode"],
                })
              }
            >
              <option value="vertical">縦書き</option>
              <option value="horizontal">横書き</option>
            </select>
          </label>
          <label>
            文字サイズ
            <input
              type="number"
              min="1"
              max="2000"
              defaultValue={item.fontSize}
              onBlur={(event) =>
                saveText({ ...item, fontSize: Number(event.target.value) })
              }
            />
          </label>
          <label>
            文字色
            <input
              type="color"
              value={item.color}
              onChange={(event) =>
                saveText({ ...item, color: event.target.value })
              }
            />
          </label>
          <label>
            揃え
            <select
              value={item.textAlign}
              onChange={(event) =>
                saveText({
                  ...item,
                  textAlign: event.target.value as TextObject["textAlign"],
                })
              }
            >
              <option value="start">先頭</option>
              <option value="center">中央</option>
              <option value="end">末尾</option>
            </select>
          </label>
        </>
      )}
    </div>
  );
}

export function MangaCanvas({
  bundle,
  page,
  assetUrls,
  selectedAssetId,
  zoom,
  onApply,
}: {
  bundle: ProjectBundle;
  page: Page;
  assetUrls: Record<string, string>;
  selectedAssetId: string | null;
  zoom: number;
  onApply: (promise: Promise<ProjectBundle>) => void;
}) {
  const [selection, setSelection] = React.useState<Selection>(null);
  const [guides, setGuides] = React.useState<{
    vertical: number[];
    horizontal: number[];
  }>({ vertical: [], horizontal: [] });
  const transformer = React.useRef<any>(null);
  const renderLegacyGroups = bundle.project.id === "";
  const scale = zoom / 100;
  const pageImage = useImage(
    page.imageAssetId ? assetUrls[page.imageAssetId] : undefined,
  );
  const panels = bundle.panels
    .filter((item) => item.pageId === page.id)
    .sort((a, b) => a.zIndex - b.zIndex);
  const balloons = bundle.balloons
    .filter((item) => item.pageId === page.id)
    .sort((a, b) => a.zIndex - b.zIndex);
  const texts = bundle.textObjects
    .filter((item) => item.pageId === page.id)
    .sort((a, b) => a.zIndex - b.zIndex);
  const layers = [
    ...panels.map((item) => ({ ...item, objectType: "panel" as const })),
    ...balloons.map((item) => ({ ...item, objectType: "balloon" as const })),
    ...texts.map((item) => ({ ...item, objectType: "text" as const })),
  ].sort((a, b) => b.zIndex - a.zIndex);

  React.useEffect(() => setSelection(null), [page.id]);
  const select = (
    type: "panel" | "balloon" | "text",
    id: string,
    node: any,
  ) => {
    setSelection({ type, id });
    transformer.current?.nodes([node]);
    transformer.current?.getLayer()?.batchDraw();
  };
  const nextZ = layers.length
    ? Math.max(...layers.map((item) => item.zIndex)) + 1
    : 0;
  const selectedPanel =
    selection?.type === "panel"
      ? panels.find((item) => item.id === selection.id)
      : undefined;
  const selectedLayer = selection
    ? layers.find((item) => item.id === selection.id)
    : undefined;
  const snapMove = (
    id: string,
    rect: { x: number; y: number; width: number; height: number },
  ) => {
    const result = snapRectToGuides(
      rect,
      page,
      layers.filter((item) => item.id !== id),
      8 / scale,
    );
    setGuides(result.guides);
    return { x: result.rect.x, y: result.rect.y };
  };
  const savePanel = (item: Panel) => {
    setGuides({ vertical: [], horizontal: [] });
    const rect = constrainRectToPage(item, page);
    onApply(window.mangai.canvas.savePanel(panelInput({ ...item, ...rect })));
  };
  const saveBalloon = (item: Balloon) => {
    setGuides({ vertical: [], horizontal: [] });
    const rect = constrainRectToPage(item, page);
    onApply(
      window.mangai.canvas.saveBalloon(balloonInput({ ...item, ...rect })),
    );
  };
  const saveText = (item: TextObject) => {
    setGuides({ vertical: [], horizontal: [] });
    const rect = constrainRectToPage(item, page);
    onApply(window.mangai.canvas.saveText(textInput({ ...item, ...rect })));
  };
  const addPanel = (rect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) =>
    onApply(
      window.mangai.canvas.savePanel({
        id: crypto.randomUUID(),
        pageId: page.id,
        name: `コマ${panels.length + 1}`,
        x: rect?.x ?? page.width * 0.1,
        y: rect?.y ?? page.height * 0.1,
        width: rect?.width ?? page.width * 0.8,
        height: rect?.height ?? page.height * 0.4,
        rotation: 0,
        zIndex: nextZ,
        visible: true,
        locked: false,
        borderColor: "#000000",
        borderWidth: 4,
        fillColor: "#ffffff",
        imageAssetId: null,
        imageFit: "cover",
        imageOffsetX: 0,
        imageOffsetY: 0,
        imageScale: 1,
        imageRotation: 0,
        imageOpacity: 1,
      }),
    );
  const applyTemplate = (id: PageTemplateId) => {
    const rects = applyPageTemplate(id, page);
    return window.mangai.canvas.saveBatch({
      pageId: page.id,
      replacePanels: true,
      panels: rects.map((rect, index) => ({
        id: crypto.randomUUID(),
        pageId: page.id,
        name: `コマ${index + 1}`,
        ...rect,
        rotation: 0,
        zIndex: index,
        visible: true,
        locked: false,
        borderColor: "#000000",
        borderWidth: 4,
        fillColor: "#ffffff",
        imageAssetId: null,
        imageFit: "cover",
        imageOffsetX: 0,
        imageOffsetY: 0,
        imageScale: 1,
        imageRotation: 0,
        imageOpacity: 1,
      })),
    });
  };
  const updateLayerState = (
    item: (typeof layers)[number],
    changes: { visible?: boolean; locked?: boolean },
  ) => {
    if (item.objectType === "panel") savePanel({ ...item, ...changes });
    else if (item.objectType === "balloon")
      saveBalloon({ ...item, ...changes });
    else saveText({ ...item, ...changes });
  };
  const moveLayer = (id: string, direction: -1 | 1) => {
    const ordered = [...layers].sort((a, b) => a.zIndex - b.zIndex);
    const index = ordered.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    const normalized = ordered.map((item, zIndex) => ({ ...item, zIndex }));
    onApply(
      window.mangai.canvas.saveBatch({
        pageId: page.id,
        panels: normalized
          .filter((item) => item.objectType === "panel")
          .map((item) => panelInput(item as Panel)),
        balloons: normalized
          .filter((item) => item.objectType === "balloon")
          .map((item) => balloonInput(item as Balloon)),
        textObjects: normalized
          .filter((item) => item.objectType === "text")
          .map((item) => textInput(item as TextObject)),
      }),
    );
  };
  return (
    <div className="manga-canvas-shell">
      <div className="canvas-tools">
        <button onClick={() => addPanel()}>＋ コマ</button>
        <button
          onClick={() =>
            onApply(
              window.mangai.canvas.saveBalloon({
                id: crypto.randomUUID(),
                pageId: page.id,
                name: `吹き出し${balloons.length + 1}`,
                type: "speech_ellipse",
                x: page.width * 0.55,
                y: page.height * 0.08,
                width: page.width * 0.35,
                height: page.height * 0.2,
                rotation: 0,
                zIndex: nextZ,
                visible: true,
                locked: false,
                fillColor: "#ffffff",
                strokeColor: "#000000",
                strokeWidth: 4,
                opacity: 1,
                tailDirection: "bottom_left",
                tailOffset: 0.5,
              }),
            )
          }
        >
          ＋ 吹き出し
        </button>
        <button
          onClick={() =>
            onApply(
              window.mangai.canvas.saveText({
                id: crypto.randomUUID(),
                pageId: page.id,
                parentBalloonId:
                  selection?.type === "balloon" ? selection.id : null,
                name: `テキスト${texts.length + 1}`,
                text: "テキスト",
                writingMode: "vertical",
                x: page.width * 0.65,
                y: page.height * 0.12,
                width: page.width * 0.2,
                height: page.height * 0.3,
                rotation: 0,
                zIndex: nextZ,
                visible: true,
                locked: false,
                fontFamily: "sans-serif",
                fontSize: 48,
                fontWeight: 400,
                color: "#000000",
                textAlign: "center",
                verticalAlign: "middle",
                lineHeight: 1.2,
                letterSpacing: 0,
                padding: 16,
                opacity: 1,
              }),
            )
          }
        >
          ＋ テキスト
        </button>
        <select
          defaultValue=""
          onChange={(event) => {
            if (!event.target.value) return;
            onApply(applyTemplate(event.target.value as PageTemplateId));
            event.target.value = "";
          }}
        >
          <option value="">テンプレート…</option>
          {pageTemplates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
        {selection && (
          <button
            className="danger"
            onClick={() => {
              onApply(
                window.mangai.canvas.deleteObject(selection.type, selection.id),
              );
              setSelection(null);
            }}
          >
            選択を削除
          </button>
        )}
        {selectedPanel && selectedAssetId && (
          <button
            onClick={() =>
              savePanel({ ...selectedPanel, imageAssetId: selectedAssetId })
            }
          >
            選択コマへ素材を配置
          </button>
        )}
      </div>
      <div className="canvas-stage-row">
        <div className="konva-paper">
          <Stage
            width={page.width * scale}
            height={page.height * scale}
            scaleX={scale}
            scaleY={scale}
            onMouseDown={(event) => {
              if (event.target === event.target.getStage()) {
                setSelection(null);
                transformer.current?.nodes([]);
              }
            }}
          >
            <Layer>
              <Rect
                width={page.width}
                height={page.height}
                fill={page.backgroundColor}
              />
              {pageImage && (
                <KonvaImage
                  image={pageImage}
                  width={page.width}
                  height={page.height}
                  listening={false}
                />
              )}
              {renderLegacyGroups &&
                panels.map((panel) => (
                  <PanelNode
                    key={panel.id}
                    panel={panel}
                    imageUrl={
                      panel.imageAssetId
                        ? assetUrls[panel.imageAssetId]
                        : undefined
                    }
                    selected={
                      selection?.type === "panel" && selection.id === panel.id
                    }
                    onSelect={(node) => select("panel", panel.id, node)}
                    onSave={savePanel}
                  />
                ))}
              {renderLegacyGroups &&
                balloons
                  .filter((item) => item.visible)
                  .map((balloon: Balloon) => {
                    const Shape =
                      balloon.type === "speech_ellipse" ? Ellipse : Rect;
                    return (
                      <Shape
                        key={balloon.id}
                        x={
                          balloon.type === "speech_ellipse"
                            ? balloon.x + balloon.width / 2
                            : balloon.x
                        }
                        y={
                          balloon.type === "speech_ellipse"
                            ? balloon.y + balloon.height / 2
                            : balloon.y
                        }
                        width={balloon.width}
                        height={balloon.height}
                        radiusX={balloon.width / 2}
                        radiusY={balloon.height / 2}
                        cornerRadius={
                          balloon.type === "speech_rounded" ? 30 : 0
                        }
                        rotation={balloon.rotation}
                        fill={balloon.fillColor}
                        stroke={balloon.strokeColor}
                        strokeWidth={balloon.strokeWidth}
                        opacity={balloon.opacity}
                        draggable={!balloon.locked}
                        onClick={(event) =>
                          select("balloon", balloon.id, event.target)
                        }
                        onDragEnd={(event) => {
                          const offsetX =
                            balloon.type === "speech_ellipse"
                              ? balloon.width / 2
                              : 0;
                          const offsetY =
                            balloon.type === "speech_ellipse"
                              ? balloon.height / 2
                              : 0;
                          saveBalloon({
                            ...balloon,
                            x: event.target.x() - offsetX,
                            y: event.target.y() - offsetY,
                          });
                        }}
                        onTransformEnd={(event) => {
                          const node = event.target;
                          const width = Math.max(
                            20,
                            node.width() * node.scaleX(),
                          );
                          const height = Math.max(
                            20,
                            node.height() * node.scaleY(),
                          );
                          const centered = balloon.type === "speech_ellipse";
                          node.scaleX(1);
                          node.scaleY(1);
                          saveBalloon({
                            ...balloon,
                            x: node.x() - (centered ? width / 2 : 0),
                            y: node.y() - (centered ? height / 2 : 0),
                            width,
                            height,
                            rotation: node.rotation(),
                          });
                        }}
                      />
                    );
                  })}
              {renderLegacyGroups &&
                texts
                  .filter((item) => item.visible)
                  .map((text: TextObject) => (
                    <Text
                      key={text.id}
                      x={text.x}
                      y={text.y}
                      width={text.width}
                      height={text.height}
                      text={
                        text.writingMode === "vertical"
                          ? [...text.text].join("\n")
                          : text.text
                      }
                      fontFamily={text.fontFamily}
                      fontSize={text.fontSize}
                      fontStyle={text.fontWeight >= 600 ? "bold" : "normal"}
                      fill={text.color}
                      align={
                        text.textAlign === "start"
                          ? "left"
                          : text.textAlign === "end"
                            ? "right"
                            : "center"
                      }
                      verticalAlign={text.verticalAlign}
                      lineHeight={text.lineHeight}
                      letterSpacing={text.letterSpacing}
                      padding={text.padding}
                      opacity={text.opacity}
                      rotation={text.rotation}
                      draggable={!text.locked}
                      onClick={(event) => select("text", text.id, event.target)}
                      onDragEnd={(event) =>
                        saveText({
                          ...text,
                          x: event.target.x(),
                          y: event.target.y(),
                        })
                      }
                      onTransformEnd={(event) => {
                        const node = event.target;
                        const width = Math.max(
                          20,
                          node.width() * node.scaleX(),
                        );
                        const height = Math.max(
                          20,
                          node.height() * node.scaleY(),
                        );
                        node.scaleX(1);
                        node.scaleY(1);
                        saveText({
                          ...text,
                          x: node.x(),
                          y: node.y(),
                          width,
                          height,
                          rotation: node.rotation(),
                        });
                      }}
                    />
                  ))}
              {[...layers].reverse().map((item) => {
                if (item.objectType === "panel") {
                  const panel = item as Panel & { objectType: "panel" };
                  return (
                    <PanelNode
                      key={`panel-${panel.id}`}
                      panel={panel}
                      imageUrl={
                        panel.imageAssetId
                          ? assetUrls[panel.imageAssetId]
                          : undefined
                      }
                      selected={
                        selection?.type === "panel" && selection.id === panel.id
                      }
                      onSelect={(node) => select("panel", panel.id, node)}
                      onMove={(rect) => snapMove(panel.id, rect)}
                      onSave={savePanel}
                    />
                  );
                }
                if (item.objectType === "balloon") {
                  const balloon = item as Balloon & { objectType: "balloon" };
                  return (
                    <BalloonNode
                      key={`balloon-${balloon.id}`}
                      balloon={balloon}
                      onSelect={(node) => select("balloon", balloon.id, node)}
                      onMove={(rect) => snapMove(balloon.id, rect)}
                      onSave={saveBalloon}
                    />
                  );
                }
                const text = item as TextObject & { objectType: "text" };
                return (
                  <TextNode
                    key={`text-${text.id}`}
                    item={text}
                    onSelect={(node) => select("text", text.id, node)}
                    onMove={(rect) => snapMove(text.id, rect)}
                    onSave={saveText}
                  />
                );
              })}
              {guides.vertical.map((x) => (
                <Line
                  key={`v-${x}`}
                  points={[x, 0, x, page.height]}
                  stroke="#00a3ff"
                  strokeWidth={2 / scale}
                  listening={false}
                />
              ))}
              {guides.horizontal.map((y) => (
                <Line
                  key={`h-${y}`}
                  points={[0, y, page.width, y]}
                  stroke="#00a3ff"
                  strokeWidth={2 / scale}
                  listening={false}
                />
              ))}
              <Transformer
                ref={transformer}
                resizeEnabled={!selectedLayer?.locked}
                rotateEnabled={!selectedLayer?.locked}
                anchorSize={12 / scale}
              />
            </Layer>
          </Stage>
        </div>
        <aside className="canvas-layers">
          <h3>レイヤー</h3>
          {layers.map((item, index) => (
            <div
              className="canvas-layer-row"
              key={`${item.objectType}-${item.id}`}
            >
              <button
                className={selection?.id === item.id ? "active" : ""}
                onClick={() =>
                  setSelection({ type: item.objectType, id: item.id })
                }
              >
                <span>
                  {item.objectType === "panel"
                    ? "▣"
                    : item.objectType === "balloon"
                      ? "◯"
                      : "T"}
                </span>
                {item.name}
              </button>
              <button
                title="表示切替"
                onClick={() =>
                  updateLayerState(item, { visible: !item.visible })
                }
              >
                {item.visible ? "◉" : "○"}
              </button>
              <button
                title="ロック切替"
                onClick={() => updateLayerState(item, { locked: !item.locked })}
              >
                {item.locked ? "🔒" : "◇"}
              </button>
              <button
                disabled={index === 0}
                title="前面へ"
                onClick={() => moveLayer(item.id, 1)}
              >
                ↑
              </button>
              <button
                disabled={index === layers.length - 1}
                title="背面へ"
                onClick={() => moveLayer(item.id, -1)}
              >
                ↓
              </button>
            </div>
          ))}
          {selectedLayer && (
            <CanvasProperties
              item={selectedLayer as LayerItem}
              balloons={balloons}
              savePanel={savePanel}
              saveBalloon={saveBalloon}
              saveText={saveText}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
