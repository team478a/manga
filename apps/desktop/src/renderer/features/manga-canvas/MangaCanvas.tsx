import React from "react";
import {
  Ellipse,
  Image as KonvaImage,
  Layer,
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
  pageTemplates,
  type PageTemplateId,
} from "@mangai/canvas-core";

type Selection = { type: "panel" | "balloon" | "text"; id: string } | null;

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
  onSave,
}: {
  panel: Panel;
  imageUrl?: string;
  selected: boolean;
  onSelect: (node: any) => void;
  onSave: (value: Panel) => void;
}) {
  const image = useImage(imageUrl);
  if (!panel.visible) return null;
  return (
    <React.Fragment>
      <Rect
        id={`panel-${panel.id}`}
        x={panel.x}
        y={panel.y}
        width={panel.width}
        height={panel.height}
        rotation={panel.rotation}
        fill={panel.fillColor}
        stroke={selected ? "#2f9e68" : panel.borderColor}
        strokeWidth={
          selected ? Math.max(panel.borderWidth, 7) : panel.borderWidth
        }
        draggable={!panel.locked}
        onClick={(event) => onSelect(event.target)}
        onTap={(event) => onSelect(event.target)}
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
            width: Math.max(20, node.width() * scaleX),
            height: Math.max(20, node.height() * scaleY),
            rotation: node.rotation(),
          });
        }}
      />
      {image && (
        <KonvaImage
          image={image}
          x={panel.x}
          y={panel.y}
          width={panel.width}
          height={panel.height}
          rotation={panel.rotation}
          opacity={panel.imageOpacity}
          listening={false}
        />
      )}
    </React.Fragment>
  );
}

export function MangaCanvas({
  bundle,
  page,
  assetUrls,
  zoom,
  onApply,
}: {
  bundle: ProjectBundle;
  page: Page;
  assetUrls: Record<string, string>;
  zoom: number;
  onApply: (promise: Promise<ProjectBundle>) => void;
}) {
  const [selection, setSelection] = React.useState<Selection>(null);
  const transformer = React.useRef<any>(null);
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
  const applyTemplate = async (id: PageTemplateId) => {
    let result = bundle;
    for (const panel of panels)
      result = await window.mangai.canvas.deleteObject("panel", panel.id);
    const rects = applyPageTemplate(id, page);
    for (let index = 0; index < rects.length; index++) {
      const rect = rects[index];
      result = await window.mangai.canvas.savePanel({
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
      });
    }
    return result;
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
                parentBalloonId: null,
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
              {panels.map((panel) => (
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
                  onSave={(value) =>
                    onApply(window.mangai.canvas.savePanel(panelInput(value)))
                  }
                />
              ))}
              {balloons
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
                      cornerRadius={balloon.type === "speech_rounded" ? 30 : 0}
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
                        onApply(
                          window.mangai.canvas.saveBalloon(
                            balloonInput({
                              ...balloon,
                              x: event.target.x() - offsetX,
                              y: event.target.y() - offsetY,
                            }),
                          ),
                        );
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
                        onApply(
                          window.mangai.canvas.saveBalloon(
                            balloonInput({
                              ...balloon,
                              x: node.x() - (centered ? width / 2 : 0),
                              y: node.y() - (centered ? height / 2 : 0),
                              width,
                              height,
                              rotation: node.rotation(),
                            }),
                          ),
                        );
                      }}
                    />
                  );
                })}
              {texts
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
                      onApply(
                        window.mangai.canvas.saveText(
                          textInput({
                            ...text,
                            x: event.target.x(),
                            y: event.target.y(),
                          }),
                        ),
                      )
                    }
                    onTransformEnd={(event) => {
                      const node = event.target;
                      const width = Math.max(20, node.width() * node.scaleX());
                      const height = Math.max(
                        20,
                        node.height() * node.scaleY(),
                      );
                      node.scaleX(1);
                      node.scaleY(1);
                      onApply(
                        window.mangai.canvas.saveText(
                          textInput({
                            ...text,
                            x: node.x(),
                            y: node.y(),
                            width,
                            height,
                            rotation: node.rotation(),
                          }),
                        ),
                      );
                    }}
                  />
                ))}
              <Transformer
                ref={transformer}
                rotateEnabled
                anchorSize={12 / scale}
              />
            </Layer>
          </Stage>
        </div>
        <aside className="canvas-layers">
          <h3>レイヤー</h3>
          {layers.map((item) => (
            <button
              key={`${item.objectType}-${item.id}`}
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
          ))}
        </aside>
      </div>
    </div>
  );
}
