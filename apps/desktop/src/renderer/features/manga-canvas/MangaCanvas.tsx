import React from "react";
import {
  Ellipse,
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Shape,
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
  MIN_CANVAS_OBJECT_SIZE,
  applyPageTemplate,
  balloonTailPoints,
  computeImagePlacement,
  constrainRectToPage,
  imageTransformFromNode,
  layoutHorizontalText,
  layoutVerticalText,
  normalizeRotation,
  pageTemplates,
  panelShapeCommands,
  rectFromPoints,
  reorderLayer,
  segmentGraphemes,
  snapPointToGrid,
  snapRectToGrid,
  snapRectToGuides,
  type PanelShapeCommand,
  type Point,
  type Rect as CanvasRect,
  type PageTemplateId,
} from "@mangai/canvas-core";

type Selection = { type: "panel" | "balloon" | "text"; id: string } | null;
type SelectionKey = Exclude<Selection, null>;
type PanelDraft = { start: Point; rect: CanvasRect };
type LayerItem =
  | (Panel & { objectType: "panel" })
  | (Balloon & { objectType: "balloon" })
  | (TextObject & { objectType: "text" });
const CANVAS_GRID_SIZE = 100;
const LAYER_DRAG_TYPE = "application/x-mangai-canvas-layer";

function CanvasToolMenu({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const detailsRef = React.useRef<HTMLDetailsElement>(null);
  const close = React.useCallback((restoreFocus = false) => {
    const details = detailsRef.current;
    if (!details) return;
    details.open = false;
    if (restoreFocus) details.querySelector<HTMLElement>("summary")?.focus();
  }, []);
  React.useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (!detailsRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [close]);
  const onKeyDown = (event: React.KeyboardEvent<HTMLDetailsElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const controls = [
      ...(detailsRef.current?.querySelectorAll<HTMLElement>(
        ".canvas-tool-menu-panel button:not(:disabled), .canvas-tool-menu-panel select:not(:disabled)",
      ) ?? []),
    ];
    if (!controls.length) return;
    event.preventDefault();
    if (detailsRef.current) detailsRef.current.open = true;
    const current = controls.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? controls.length - 1
          : event.key === "ArrowDown"
            ? current < 0
              ? 0
              : (current + 1) % controls.length
            : current < 0
              ? controls.length - 1
              : (current - 1 + controls.length) % controls.length;
    controls[next].focus();
  };
  return (
    <details
      className="canvas-tool-menu"
      ref={detailsRef}
      onKeyDown={onKeyDown}
    >
      <summary>{label}</summary>
      <div
        className="canvas-tool-menu-panel"
        role="group"
        aria-label={`${label}メニュー`}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("[data-close-menu]"))
            close(true);
        }}
      >
        {children}
      </div>
    </details>
  );
}

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
    shape: panel.shape,
    slant: panel.slant,
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

function tracePanelShape(context: any, commands: PanelShapeCommand[]) {
  context.beginPath();
  for (const command of commands) {
    if (command.type === "move") context.moveTo(command.x, command.y);
    else if (command.type === "line") context.lineTo(command.x, command.y);
    else if (command.type === "curve")
      context.bezierCurveTo(
        command.control1X,
        command.control1Y,
        command.control2X,
        command.control2Y,
        command.x,
        command.y,
      );
    else context.closePath();
  }
}

function PanelNode({
  panel,
  imageUrl,
  selected,
  imageEditing,
  onSelect,
  onBeginImageEdit,
  onMove,
  onSave,
}: {
  panel: Panel;
  imageUrl?: string;
  selected: boolean;
  imageEditing: boolean;
  onSelect: (node: any, additive: boolean) => void;
  onBeginImageEdit: (node: any) => void;
  onMove?: (rect: { x: number; y: number; width: number; height: number }) => {
    x: number;
    y: number;
  };
  onSave: (value: Panel) => void;
}) {
  const image = useImage(imageUrl);
  const imageNode = React.useRef<any>(null);
  const imageTransformer = React.useRef<any>(null);
  React.useEffect(() => {
    const transformer = imageTransformer.current;
    if (!transformer) return;
    transformer.nodes(
      imageEditing && imageNode.current ? [imageNode.current] : [],
    );
    transformer.getLayer()?.batchDraw();
  }, [imageEditing, image]);
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
  const shapeCommands = panelShapeCommands(panel);
  return (
    <Group
      id={`panel-${panel.id}`}
      x={panel.x}
      y={panel.y}
      width={panel.width}
      height={panel.height}
      rotation={panel.rotation}
      draggable={!panel.locked && !imageEditing}
      onClick={(event) =>
        onSelect(event.currentTarget, Boolean(event.evt.shiftKey))
      }
      onTap={(event) => onSelect(event.currentTarget, false)}
      onDblClick={(event) => {
        if (!image || panel.locked) return;
        onBeginImageEdit(event.currentTarget);
      }}
      onDragMove={(event) => {
        if (event.target !== event.currentTarget) return;
        if (!onMove) return;
        const next = onMove({
          x: event.target.x(),
          y: event.target.y(),
          width: panel.width,
          height: panel.height,
        });
        event.target.position(next);
      }}
      onDragEnd={(event) => {
        if (event.target !== event.currentTarget) return;
        onSave({ ...panel, x: event.target.x(), y: event.target.y() });
      }}
      onTransformEnd={(event) => {
        if (event.target !== event.currentTarget) return;
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
      <Shape
        fill={panel.fillColor}
        listening={false}
        sceneFunc={(context, shape) => {
          tracePanelShape(context, shapeCommands);
          context.fillStrokeShape(shape);
        }}
      />
      {image && placement && (
        <Group
          clipFunc={(context) => {
            tracePanelShape(context, shapeCommands);
          }}
        >
          <KonvaImage
            ref={imageNode}
            image={image}
            x={placement.x}
            y={placement.y}
            width={placement.width}
            height={placement.height}
            rotation={panel.imageRotation}
            opacity={panel.imageOpacity}
            draggable={imageEditing}
            listening={imageEditing}
            onClick={(event) => {
              event.cancelBubble = true;
            }}
            onTap={(event) => {
              event.cancelBubble = true;
            }}
            onDragEnd={(event) => {
              event.cancelBubble = true;
              onSave({
                ...panel,
                imageOffsetX:
                  panel.imageOffsetX + event.target.x() - placement.x,
                imageOffsetY:
                  panel.imageOffsetY + event.target.y() - placement.y,
              });
            }}
            onTransformEnd={(event) => {
              event.cancelBubble = true;
              const node = event.target;
              const transform = imageTransformFromNode(
                { width: image.naturalWidth, height: image.naturalHeight },
                { x: 0, y: 0, width: panel.width, height: panel.height },
                { fit: panel.imageFit, scale: panel.imageScale },
                {
                  x: node.x(),
                  y: node.y(),
                  scaleX: node.scaleX(),
                  scaleY: node.scaleY(),
                },
              );
              node.scaleX(1);
              node.scaleY(1);
              onSave({
                ...panel,
                imageScale: transform.scale,
                imageOffsetX: transform.offsetX,
                imageOffsetY: transform.offsetY,
                imageRotation: normalizeRotation(node.rotation()),
              });
            }}
          />
        </Group>
      )}
      <Shape
        stroke={selected ? "#2f9e68" : panel.borderColor}
        strokeWidth={
          selected ? Math.max(panel.borderWidth, 7) : panel.borderWidth
        }
        sceneFunc={(context, shape) => {
          tracePanelShape(context, shapeCommands);
          context.fillStrokeShape(shape);
        }}
      />
      {imageEditing && image && (
        <Transformer
          ref={imageTransformer}
          enabledAnchors={[
            "top-left",
            "top-right",
            "bottom-left",
            "bottom-right",
          ]}
          keepRatio
          rotateEnabled
          flipEnabled={false}
          borderStroke="#e67e22"
          anchorFill="#ffffff"
          anchorStroke="#e67e22"
          anchorSize={14}
        />
      )}
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
  onSelect: (node: any, additive: boolean) => void;
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
      id={`balloon-${balloon.id}`}
      x={balloon.x}
      y={balloon.y}
      width={balloon.width}
      height={balloon.height}
      rotation={balloon.rotation}
      draggable={!balloon.locked}
      onClick={(event) =>
        onSelect(event.currentTarget, Boolean(event.evt.shiftKey))
      }
      onTap={(event) => onSelect(event.currentTarget, false)}
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

function TextNode({
  item,
  onSelect,
  onMove,
  onSave,
}: {
  item: TextObject;
  onSelect: (node: any, additive: boolean) => void;
  onMove?: (rect: { x: number; y: number; width: number; height: number }) => {
    x: number;
    y: number;
  };
  onSave: (value: TextObject) => void;
}) {
  if (!item.visible) return null;
  if (item.writingMode === "vertical") {
    const layout = layoutVerticalText(
      item.text,
      {
        x: item.padding,
        y: item.padding,
        width: Math.max(1, item.width - item.padding * 2),
        height: Math.max(1, item.height - item.padding * 2),
      },
      {
        fontSize: item.fontSize,
        lineHeight: item.lineHeight,
        letterSpacing: item.letterSpacing,
      },
    );
    return (
      <Group
        id={`text-${item.id}`}
        x={item.x}
        y={item.y}
        width={item.width}
        height={item.height}
        rotation={item.rotation}
        opacity={item.opacity}
        draggable={!item.locked}
        onClick={(event) =>
          onSelect(event.currentTarget, Boolean(event.evt.shiftKey))
        }
        onTap={(event) => onSelect(event.currentTarget, false)}
        onDragMove={(event) => {
          if (!onMove) return;
          const next = onMove({
            x: event.currentTarget.x(),
            y: event.currentTarget.y(),
            width: item.width,
            height: item.height,
          });
          event.currentTarget.position(next);
        }}
        onDragEnd={(event) =>
          onSave({
            ...item,
            x: event.currentTarget.x(),
            y: event.currentTarget.y(),
          })
        }
        onTransformEnd={(event) => {
          const node = event.currentTarget;
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
      >
        {layout.glyphs.map((glyph, index) => {
          const fontSize = glyph.tateChuYoko
            ? item.fontSize * 0.62
            : item.fontSize;
          const cellWidth = item.fontSize * item.lineHeight;
          return (
            <Text
              key={`${glyph.column}-${glyph.row}-${index}`}
              x={glyph.x - cellWidth / 2}
              y={glyph.y - item.fontSize / 2}
              width={cellWidth}
              height={item.fontSize}
              text={glyph.value}
              fontFamily={item.fontFamily}
              fontSize={fontSize}
              fontStyle={item.fontWeight >= 600 ? "bold" : "normal"}
              fill={item.color}
              align="center"
              verticalAlign="middle"
              letterSpacing={glyph.tateChuYoko ? 0 : item.letterSpacing}
              listening={false}
            />
          );
        })}
        {layout.rubyGlyphs.map((glyph, index) => (
          <Text
            key={`ruby-${glyph.column}-${index}`}
            x={glyph.x - item.fontSize * 0.3}
            y={glyph.y - item.fontSize * 0.25}
            width={item.fontSize * 0.6}
            height={item.fontSize * 0.5}
            text={glyph.value}
            fontFamily={item.fontFamily}
            fontSize={item.fontSize * 0.42}
            fontStyle={item.fontWeight >= 600 ? "bold" : "normal"}
            fill={item.color}
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        ))}
      </Group>
    );
  }
  const layout = layoutHorizontalText(
    item.text,
    {
      x: item.padding,
      y: item.padding,
      width: Math.max(1, item.width - item.padding * 2),
      height: Math.max(1, item.height - item.padding * 2),
    },
    {
      fontSize: item.fontSize,
      lineHeight: item.lineHeight,
      letterSpacing: item.letterSpacing,
      textAlign: item.textAlign,
      verticalAlign: item.verticalAlign,
    },
  );
  return (
    <Group
      id={`text-${item.id}`}
      x={item.x}
      y={item.y}
      width={item.width}
      height={item.height}
      opacity={item.opacity}
      rotation={item.rotation}
      draggable={!item.locked}
      onClick={(event) =>
        onSelect(event.currentTarget, Boolean(event.evt.shiftKey))
      }
      onTap={(event) => onSelect(event.currentTarget, false)}
      onDragMove={(event) => {
        if (!onMove) return;
        const next = onMove({
          x: event.currentTarget.x(),
          y: event.currentTarget.y(),
          width: item.width,
          height: item.height,
        });
        event.currentTarget.position(next);
      }}
      onDragEnd={(event) =>
        onSave({
          ...item,
          x: event.currentTarget.x(),
          y: event.currentTarget.y(),
        })
      }
      onTransformEnd={(event) => {
        const node = event.currentTarget;
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
    >
      {layout.lines.map((line, index) => (
        <Text
          key={`line-${index}`}
          x={line.x}
          y={line.y - item.fontSize}
          width={Math.max(1, line.width)}
          height={item.fontSize * item.lineHeight}
          text={line.value}
          fontFamily={item.fontFamily}
          fontSize={item.fontSize}
          fontStyle={item.fontWeight >= 600 ? "bold" : "normal"}
          fill={item.color}
          letterSpacing={item.letterSpacing}
          listening={false}
        />
      ))}
      {layout.rubyRuns.map((ruby, index) => (
        <Text
          key={`ruby-${ruby.line}-${index}`}
          x={ruby.x - Math.max(ruby.width, item.fontSize) / 2}
          y={ruby.y - item.fontSize * 0.42}
          width={Math.max(ruby.width, item.fontSize)}
          height={item.fontSize * 0.5}
          text={ruby.value}
          fontFamily={item.fontFamily}
          fontSize={item.fontSize * 0.42}
          fontStyle={item.fontWeight >= 600 ? "bold" : "normal"}
          fill={item.color}
          align="center"
          listening={false}
        />
      ))}
    </Group>
  );
}

function DebouncedTextArea({
  initialValue,
  onCommit,
  rubyTools = false,
}: {
  initialValue: string;
  onCommit: (value: string) => void;
  rubyTools?: boolean;
}) {
  const [value, setValue] = React.useState(initialValue);
  const [selection, setSelection] = React.useState({ start: 0, end: 0 });
  const [reading, setReading] = React.useState("");
  const [rubyError, setRubyError] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const commitRef = React.useRef(onCommit);
  commitRef.current = onCommit;
  React.useEffect(() => {
    setValue(initialValue);
    setRubyError("");
  }, [initialValue]);
  React.useEffect(() => {
    if (value === initialValue) return;
    const timer = window.setTimeout(() => commitRef.current(value), 600);
    return () => window.clearTimeout(timer);
  }, [value, initialValue]);
  const rememberSelection = (target: HTMLTextAreaElement) =>
    setSelection({ start: target.selectionStart, end: target.selectionEnd });
  const replaceSelection = (
    replacement: string,
    nextSelectionStart: number,
    nextSelectionEnd = nextSelectionStart,
  ) => {
    const next =
      value.slice(0, selection.start) +
      replacement +
      value.slice(selection.end);
    setValue(next);
    setRubyError("");
    setSelection({
      start: nextSelectionStart,
      end: nextSelectionEnd,
    });
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(
        nextSelectionStart,
        nextSelectionEnd,
      );
    });
  };
  const applyRuby = () => {
    const base = value.slice(selection.start, selection.end);
    const ruby = reading.trim();
    if (!base) return setRubyError("本文から親文字を選択してください。");
    if (!ruby) return setRubyError("ルビの読みを入力してください。");
    if (/[｜《》\r\n]/u.test(base) || /[｜《》\r\n]/u.test(ruby))
      return setRubyError("選択文字と読みには改行やルビ記号を含められません。");
    if (segmentGraphemes(base).length > 50)
      return setRubyError("親文字は50文字以内で選択してください。");
    if (segmentGraphemes(ruby).length > 100)
      return setRubyError("読みは100文字以内で入力してください。");
    const notation = `｜${base}《${ruby}》`;
    replaceSelection(
      notation,
      selection.start + 1,
      selection.start + 1 + base.length,
    );
    setReading("");
  };
  const removeRuby = () => {
    const expression = /｜([^｜《》\r\n]{1,50})《([^｜《》\r\n]{1,100})》/gu;
    const match = [...value.matchAll(expression)].find((candidate) => {
      const start = candidate.index ?? 0;
      const end = start + candidate[0].length;
      return selection.start >= start && selection.end <= end;
    });
    if (!match)
      return setRubyError("解除するルビ記法の中へカーソルを置いてください。");
    const start = match.index ?? 0;
    setSelection({ start, end: start + match[0].length });
    const next =
      value.slice(0, start) + match[1] + value.slice(start + match[0].length);
    setValue(next);
    setRubyError("");
    setReading("");
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(start, start + match[1].length);
    });
  };
  const selectedText = value.slice(selection.start, selection.end);
  return (
    <div className="ruby-editor">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          rememberSelection(event.target);
        }}
        onSelect={(event) => rememberSelection(event.currentTarget)}
      />
      {rubyTools && (
        <>
          <p className="ruby-selection">
            {selectedText
              ? `親文字: ${selectedText}`
              : "本文からルビを付ける親文字を選択"}
          </p>
          <div className="ruby-controls">
            <input
              value={reading}
              aria-label="ルビの読み"
              placeholder="読み（例: まんが）"
              onChange={(event) => {
                setReading(event.target.value);
                setRubyError("");
              }}
            />
            <button type="button" onClick={applyRuby}>
              ルビを追加
            </button>
            <button type="button" className="secondary" onClick={removeRuby}>
              解除
            </button>
          </div>
          {rubyError && (
            <p className="ruby-error" role="alert">
              {rubyError}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function CanvasProperties({
  item,
  balloons,
  imageEditing,
  onBeginImageEdit,
  onFinishImageEdit,
  savePanel,
  saveBalloon,
  saveText,
}: {
  item: LayerItem;
  balloons: Balloon[];
  imageEditing: boolean;
  onBeginImageEdit: (panel: Panel) => void;
  onFinishImageEdit: () => void;
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
      : layoutHorizontalText(
          item.text,
          {
            x: item.padding,
            y: item.padding,
            width: Math.max(1, item.width - item.padding * 2),
            height: Math.max(1, item.height - item.padding * 2),
          },
          {
            fontSize: item.fontSize,
            lineHeight: item.lineHeight,
            letterSpacing: item.letterSpacing,
            textAlign: item.textAlign,
            verticalAlign: item.verticalAlign,
          },
        ).overflow);
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
            コマ形状
            <select
              value={item.shape}
              onChange={(event) =>
                savePanel({
                  ...item,
                  shape: event.target.value as Panel["shape"],
                })
              }
            >
              <option value="rectangle">矩形</option>
              <option value="slant_up">斜め（右上がり ／）</option>
              <option value="slant_down">斜め（右下がり ＼）</option>
              <option value="curve_left">曲線（左辺）</option>
              <option value="curve_right">曲線（右辺）</option>
            </select>
          </label>
          {item.shape !== "rectangle" && (
            <label>
              変形率（%）
              <input
                type="number"
                min="0"
                max="45"
                step="1"
                defaultValue={Math.round(item.slant * 100)}
                onBlur={(event) =>
                  savePanel({
                    ...item,
                    slant: Math.min(
                      0.45,
                      Math.max(0, Number(event.target.value) / 100),
                    ),
                  })
                }
              />
            </label>
          )}
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
            <>
              <button
                className={imageEditing ? "active" : "secondary"}
                disabled={item.locked}
                onClick={() =>
                  imageEditing ? onFinishImageEdit() : onBeginImageEdit(item)
                }
              >
                {imageEditing ? "画像編集を終了" : "Canvasで画像を編集"}
              </button>
              <button
                className="secondary"
                onClick={() =>
                  savePanel({
                    ...item,
                    imageScale: 1,
                    imageOffsetX: 0,
                    imageOffsetY: 0,
                    imageRotation: 0,
                  })
                }
              >
                画像を中央へリセット
              </button>
              <button
                className="secondary"
                onClick={() => {
                  onFinishImageEdit();
                  savePanel({ ...item, imageAssetId: null });
                }}
              >
                画像を外す
              </button>
            </>
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
          <div className="canvas-field">
            <span>本文</span>
            <DebouncedTextArea
              initialValue={item.text}
              rubyTools
              onCommit={(text) => saveText({ ...item, text })}
            />
          </div>
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
          <small>
            {item.writingMode === "vertical"
              ? "基本禁則と半角2桁数字の縦中横を自動適用します。"
              : "日本語・ASCIIの文字幅を考慮して折り返します。"}
            ルビは「｜漫画《まんが》」の形式で保存します。
          </small>
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
  const [selectedKeys, setSelectedKeys] = React.useState<SelectionKey[]>([]);
  const [drawPanelMode, setDrawPanelMode] = React.useState(false);
  const [panelDraft, setPanelDraft] = React.useState<PanelDraft | null>(null);
  const [editingPanelImageId, setEditingPanelImageId] = React.useState<
    string | null
  >(null);
  const [draggingLayer, setDraggingLayer] = React.useState<SelectionKey | null>(
    null,
  );
  const [layerDropTarget, setLayerDropTarget] = React.useState<{
    key: SelectionKey;
    placement: "before" | "after";
  } | null>(null);
  const [showGrid, setShowGrid] = React.useState(false);
  const [showLayers, setShowLayers] = React.useState(() => {
    try {
      const stored = localStorage.getItem("mangai.canvas-layers-open");
      return stored === null ? window.innerWidth >= 1150 : stored === "true";
    } catch {
      return true;
    }
  });
  const [snapEnabled, setSnapEnabled] = React.useState(true);
  const [gridSnapEnabled, setGridSnapEnabled] = React.useState(false);
  const stageRef = React.useRef<any>(null);
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

  React.useEffect(() => {
    setSelection(null);
    setSelectedKeys([]);
    setPanelDraft(null);
    setDrawPanelMode(false);
    setEditingPanelImageId(null);
    setDraggingLayer(null);
    setLayerDropTarget(null);
    transformer.current?.nodes([]);
  }, [page.id]);
  React.useEffect(() => {
    try {
      localStorage.setItem("mangai.canvas-layers-open", String(showLayers));
    } catch {
      // 設定保存が利用できない環境でも開閉操作は継続する。
    }
  }, [showLayers]);
  const select = (
    type: "panel" | "balloon" | "text",
    id: string,
    node: any | null,
    additive = false,
  ) => {
    if (editingPanelImageId && (type !== "panel" || id !== editingPanelImageId))
      setEditingPanelImageId(null);
    const key = { type, id } as SelectionKey;
    let nextKeys: SelectionKey[];
    if (additive) {
      const exists = selectedKeys.some(
        (item) => item.type === type && item.id === id,
      );
      nextKeys = exists
        ? selectedKeys.filter((item) => !(item.type === type && item.id === id))
        : [...selectedKeys, key];
    } else {
      nextKeys = [key];
    }
    setSelectedKeys(nextKeys);
    setSelection(nextKeys.at(-1) ?? null);
    const stage = node?.getStage?.() ?? transformer.current?.getStage();
    const nextNodes = stage
      ? nextKeys
          .map((item) => stage.findOne(`#${item.type}-${item.id}`))
          .filter(Boolean)
      : node
        ? [node]
        : [];
    transformer.current?.nodes(nextNodes);
    transformer.current?.getLayer()?.batchDraw();
  };
  const isSelected = (type: SelectionKey["type"], id: string) =>
    selectedKeys.some((item) => item.type === type && item.id === id);
  const nextZ = layers.length
    ? Math.max(...layers.map((item) => item.zIndex)) + 1
    : 0;
  const selectedPanel =
    selection?.type === "panel"
      ? panels.find((item) => item.id === selection.id)
      : undefined;
  const editingPanel = editingPanelImageId
    ? panels.find((item) => item.id === editingPanelImageId)
    : undefined;
  const selectedLayer = selection
    ? layers.find(
        (item) =>
          item.objectType === selection.type && item.id === selection.id,
      )
    : undefined;
  const selectedItems = layers.filter((item) =>
    isSelected(item.objectType, item.id),
  );
  const saveItems = (items: LayerItem[]) =>
    onApply(
      window.mangai.canvas.saveBatch({
        pageId: page.id,
        panels: items
          .filter((item) => item.objectType === "panel")
          .map((item) => panelInput(item as Panel)),
        balloons: items
          .filter((item) => item.objectType === "balloon")
          .map((item) => balloonInput(item as Balloon)),
        textObjects: items
          .filter((item) => item.objectType === "text")
          .map((item) => textInput(item as TextObject)),
      }),
    );
  const snapMove = (
    id: string,
    rect: { x: number; y: number; width: number; height: number },
  ) => {
    const gridRect =
      snapEnabled && gridSnapEnabled
        ? snapRectToGrid(rect, CANVAS_GRID_SIZE)
        : rect;
    const result = snapEnabled
      ? snapRectToGuides(
          gridRect,
          page,
          layers.filter((item) => item.id !== id),
          8 / scale,
        )
      : {
          rect: gridRect,
          guides: { vertical: [], horizontal: [] },
        };
    setGuides(result.guides);
    const source = layers.find((item) => item.id === id);
    if (
      selectedKeys.length > 1 &&
      source &&
      isSelected(source.objectType, id)
    ) {
      const stage = transformer.current?.getStage();
      if (stage) {
        const deltaX = result.rect.x - source.x;
        const deltaY = result.rect.y - source.y;
        for (const item of selectedItems) {
          if (item.id === id) continue;
          stage
            .findOne(`#${item.objectType}-${item.id}`)
            ?.position({ x: item.x + deltaX, y: item.y + deltaY });
        }
      }
    }
    return { x: result.rect.x, y: result.rect.y };
  };
  const saveGroupMove = (item: LayerItem) => {
    if (selectedKeys.length <= 1 || !isSelected(item.objectType, item.id))
      return false;
    const source = layers.find(
      (value) => value.objectType === item.objectType && value.id === item.id,
    );
    if (!source || (source.x === item.x && source.y === item.y)) return false;
    const deltaX = item.x - source.x;
    const deltaY = item.y - source.y;
    setGuides({ vertical: [], horizontal: [] });
    const selectedBalloonIds = new Set(
      selectedItems
        .filter((value) => value.objectType === "balloon")
        .map((value) => value.id),
    );
    const itemsToMove = [
      ...selectedItems,
      ...layers.filter(
        (value) =>
          value.objectType === "text" &&
          value.parentBalloonId &&
          selectedBalloonIds.has(value.parentBalloonId) &&
          !isSelected("text", value.id),
      ),
    ];
    saveItems(
      itemsToMove.map((value) => ({
        ...value,
        ...constrainRectToPage(
          { ...value, x: value.x + deltaX, y: value.y + deltaY },
          page,
        ),
      })) as LayerItem[],
    );
    return true;
  };
  const savePanel = (item: Panel) => {
    if (saveGroupMove({ ...item, objectType: "panel" })) return;
    setGuides({ vertical: [], horizontal: [] });
    const rect = constrainRectToPage(item, page);
    onApply(window.mangai.canvas.savePanel(panelInput({ ...item, ...rect })));
  };
  const dropAssetOnPanel = (event: React.DragEvent<HTMLDivElement>) => {
    const assetId = event.dataTransfer.getData("application/x-mangai-asset-id");
    if (!assetId || !bundle.assets.some((asset) => asset.id === assetId))
      return;
    event.preventDefault();
    event.stopPropagation();
    const stage = stageRef.current;
    if (!stage) return;
    stage.setPointersPositions(event.nativeEvent);
    const position = stage.getPointerPosition();
    let node = position ? stage.getIntersection(position) : null;
    while (node && node !== stage && !node.id()?.startsWith("panel-"))
      node = node.getParent();
    const panelId = node?.id()?.replace(/^panel-/, "");
    const panel = panels.find((value) => value.id === panelId);
    if (!panel || panel.locked) return;
    savePanel({ ...panel, imageAssetId: assetId });
    select("panel", panel.id, node);
  };
  const saveBalloon = (item: Balloon) => {
    if (saveGroupMove({ ...item, objectType: "balloon" })) return;
    setGuides({ vertical: [], horizontal: [] });
    const rect = constrainRectToPage(item, page);
    onApply(
      window.mangai.canvas.saveBalloon(balloonInput({ ...item, ...rect })),
    );
  };
  const saveText = (item: TextObject) => {
    if (saveGroupMove({ ...item, objectType: "text" })) return;
    setGuides({ vertical: [], horizontal: [] });
    const rect = constrainRectToPage(item, page);
    onApply(window.mangai.canvas.saveText(textInput({ ...item, ...rect })));
  };
  const clearSelection = () => {
    setEditingPanelImageId(null);
    setSelection(null);
    setSelectedKeys([]);
    transformer.current?.nodes([]);
  };
  const beginImageEdit = (panel: Panel, node?: any) => {
    if (!panel.imageAssetId || panel.locked) return;
    setDrawPanelMode(false);
    setPanelDraft(null);
    const panelNode =
      node ?? stageRef.current?.findOne?.(`#panel-${panel.id}`) ?? null;
    select("panel", panel.id, panelNode);
    transformer.current?.nodes([]);
    transformer.current?.getLayer()?.batchDraw();
    setEditingPanelImageId(panel.id);
  };
  const finishImageEdit = () => {
    const panelId = editingPanelImageId;
    setEditingPanelImageId(null);
    if (!panelId) return;
    window.requestAnimationFrame(() => {
      const node = stageRef.current?.findOne?.(`#panel-${panelId}`);
      if (!node) return;
      transformer.current?.nodes([node]);
      transformer.current?.getLayer()?.batchDraw();
    });
  };
  const getPagePointer = () => {
    const pointer = stageRef.current?.getPointerPosition();
    return pointer
      ? {
          x: pointer.x / scale,
          y: pointer.y / scale,
        }
      : null;
  };
  const deleteSelected = () => {
    if (!selectedItems.length || selectedItems.some((item) => item.locked))
      return;
    const panelIds = new Set(
      selectedItems
        .filter((item) => item.objectType === "panel")
        .map((item) => item.id),
    );
    const balloonIds = new Set(
      selectedItems
        .filter((item) => item.objectType === "balloon")
        .map((item) => item.id),
    );
    const textIds = new Set(
      selectedItems
        .filter((item) => item.objectType === "text")
        .map((item) => item.id),
    );
    onApply(
      window.mangai.canvas.saveBatch({
        pageId: page.id,
        panels: panels.filter((item) => !panelIds.has(item.id)).map(panelInput),
        balloons: balloons
          .filter((item) => !balloonIds.has(item.id))
          .map(balloonInput),
        textObjects: texts
          .filter(
            (item) =>
              !textIds.has(item.id) &&
              (!item.parentBalloonId || !balloonIds.has(item.parentBalloonId)),
          )
          .map(textInput),
        replacePanels: true,
        replaceBalloons: true,
        replaceTextObjects: true,
      }),
    );
    clearSelection();
  };
  const duplicateSelected = () => {
    if (!selectedItems.length || selectedItems.some((item) => item.locked))
      return;
    const selectedBalloonIds = new Set(
      selectedItems
        .filter((item) => item.objectType === "balloon")
        .map((item) => item.id),
    );
    const itemsToCopy = [
      ...selectedItems,
      ...layers.filter(
        (item) =>
          item.objectType === "text" &&
          item.parentBalloonId &&
          selectedBalloonIds.has(item.parentBalloonId) &&
          !isSelected("text", item.id),
      ),
    ];
    const idMap = new Map(
      itemsToCopy.map((item) => [item.id, crypto.randomUUID()]),
    );
    const copies = [...itemsToCopy]
      .sort((a, b) => a.zIndex - b.zIndex)
      .map((item, index) => {
        const copy = {
          ...item,
          id: idMap.get(item.id)!,
          name: `${item.name} のコピー`,
          x: item.x + 20,
          y: item.y + 20,
          zIndex: nextZ + index,
        } as LayerItem;
        if (copy.objectType === "text" && copy.parentBalloonId)
          copy.parentBalloonId =
            idMap.get(copy.parentBalloonId) ?? copy.parentBalloonId;
        return copy;
      });
    saveItems(copies);
    clearSelection();
  };
  React.useEffect(() => {
    if (!selectedLayer) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable=true]"))
        return;
      if (selectedItems.some((item) => item.locked)) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelected();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelected();
        return;
      }
      const distance = event.shiftKey ? 10 : 1;
      const movement = {
        ArrowLeft: { x: -distance, y: 0 },
        ArrowRight: { x: distance, y: 0 },
        ArrowUp: { x: 0, y: -distance },
        ArrowDown: { x: 0, y: distance },
      }[event.key];
      if (!movement) return;
      event.preventDefault();
      const moved = {
        ...selectedLayer,
        x: selectedLayer.x + movement.x,
        y: selectedLayer.y + movement.y,
      };
      if (moved.objectType === "panel") savePanel(moved);
      else if (moved.objectType === "balloon") saveBalloon(moved);
      else saveText(moved);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedLayer, nextZ, onApply]);
  React.useEffect(() => {
    if (!drawPanelMode) return;
    const cancelDrawing = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setPanelDraft(null);
      setDrawPanelMode(false);
    };
    window.addEventListener("keydown", cancelDrawing);
    return () => window.removeEventListener("keydown", cancelDrawing);
  }, [drawPanelMode]);
  React.useEffect(() => {
    if (!editingPanelImageId) return;
    const finishEditing = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      finishImageEdit();
    };
    window.addEventListener("keydown", finishEditing);
    return () => window.removeEventListener("keydown", finishEditing);
  }, [editingPanelImageId]);
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
        shape: "rectangle",
        slant: 0.12,
        imageAssetId: null,
        imageFit: "cover",
        imageOffsetX: 0,
        imageOffsetY: 0,
        imageScale: 1,
        imageRotation: 0,
        imageOpacity: 1,
      }),
    );
  const addBalloon = () => {
    const balloonId = crypto.randomUUID();
    const balloon = {
      id: balloonId,
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
    } as const;
    onApply(
      window.mangai.canvas.saveBatch({
        pageId: page.id,
        balloons: [balloon],
        textObjects: [
          {
            id: crypto.randomUUID(),
            pageId: page.id,
            parentBalloonId: balloonId,
            name: `テキスト${texts.length + 1}`,
            text: "テキスト",
            writingMode: "vertical",
            x: balloon.x + balloon.width * 0.2,
            y: balloon.y + balloon.height * 0.15,
            width: balloon.width * 0.6,
            height: balloon.height * 0.7,
            rotation: 0,
            zIndex: nextZ + 1,
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
          },
        ],
      }),
    );
  };
  const addText = () =>
    onApply(
      window.mangai.canvas.saveText({
        id: crypto.randomUUID(),
        pageId: page.id,
        parentBalloonId: selection?.type === "balloon" ? selection.id : null,
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
    );
  const updatePanelDraft = () => {
    if (!panelDraft) return;
    const pointer = getPagePointer();
    if (!pointer) return;
    setPanelDraft({
      ...panelDraft,
      rect: rectFromPoints(
        panelDraft.start,
        pointer,
        page,
        snapEnabled && gridSnapEnabled ? CANVAS_GRID_SIZE : undefined,
      ),
    });
  };
  const finishPanelDraft = () => {
    if (!panelDraft) return;
    const rect = panelDraft.rect;
    setPanelDraft(null);
    setDrawPanelMode(false);
    if (
      rect.width < MIN_CANVAS_OBJECT_SIZE ||
      rect.height < MIN_CANVAS_OBJECT_SIZE
    )
      return;
    addPanel(rect);
  };
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
        shape: "rectangle",
        slant: 0.12,
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
  const applyLayerOrder = (
    dragged: SelectionKey,
    target: SelectionKey,
    placement: "before" | "after",
  ) => {
    const ordered = reorderLayer(
      layers.map((item) => ({
        id: item.id,
        type: item.objectType,
        name: item.name,
        zIndex: item.zIndex,
        visible: item.visible,
        locked: item.locked,
        parentId: item.objectType === "text" ? item.parentBalloonId : undefined,
      })),
      dragged,
      target,
      placement,
    );
    const zIndexes = new Map(
      ordered.map((item) => [`${item.type}:${item.id}`, item.zIndex]),
    );
    const normalized = layers.map((item) => ({
      ...item,
      zIndex: zIndexes.get(`${item.objectType}:${item.id}`) ?? item.zIndex,
    })) as LayerItem[];
    if (
      normalized.every(
        (item) =>
          item.zIndex ===
          layers.find(
            (value) =>
              value.objectType === item.objectType && value.id === item.id,
          )?.zIndex,
      )
    )
      return;
    saveItems(normalized);
  };
  const moveLayerStep = (item: LayerItem, direction: -1 | 1) => {
    const index = layers.findIndex(
      (value) => value.objectType === item.objectType && value.id === item.id,
    );
    const target = layers[index - direction];
    if (index < 0 || !target) return;
    applyLayerOrder(
      { type: item.objectType, id: item.id },
      { type: target.objectType, id: target.id },
      direction === 1 ? "before" : "after",
    );
  };
  return (
    <div className="manga-canvas-shell">
      <div
        className="canvas-tools"
        role="toolbar"
        aria-label="Canvas編集ツール"
      >
        <CanvasToolMenu label="＋ 追加">
          <button data-close-menu onClick={() => addPanel()}>
            コマを追加
          </button>
          <button
            data-close-menu
            className={drawPanelMode ? "active" : undefined}
            aria-pressed={drawPanelMode}
            aria-keyshortcuts="Escape"
            title="ページ上をドラッグしてコマを作成（Escで解除）"
            onClick={() => {
              setPanelDraft(null);
              setDrawPanelMode((value) => !value);
            }}
          >
            ▭ コマを描く
          </button>
          <button data-close-menu onClick={addBalloon}>
            吹き出しを追加
          </button>
          <button data-close-menu onClick={addText}>
            {selection?.type === "balloon"
              ? "選択吹き出しへテキスト追加"
              : "テキストを追加"}
          </button>
        </CanvasToolMenu>
        <CanvasToolMenu label="レイアウト">
          {pageTemplates.map((template) => (
            <button
              data-close-menu
              key={template.id}
              title="現在のコマを置き換えてテンプレートを適用"
              onClick={() => onApply(applyTemplate(template.id))}
            >
              {template.name}
            </button>
          ))}
        </CanvasToolMenu>
        <CanvasToolMenu label="表示">
          <button
            className={showGrid ? "active" : undefined}
            aria-pressed={showGrid}
            onClick={() => setShowGrid((value) => !value)}
          >
            # グリッド
          </button>
          <button
            className={snapEnabled ? "active" : undefined}
            aria-pressed={snapEnabled}
            onClick={() => {
              setSnapEnabled((value) => !value);
              setGuides({ vertical: [], horizontal: [] });
            }}
          >
            スナップ
          </button>
          <button
            className={gridSnapEnabled ? "active" : undefined}
            aria-pressed={gridSnapEnabled}
            disabled={!snapEnabled}
            title="100pxグリッドへ吸着"
            onClick={() => setGridSnapEnabled((value) => !value)}
          >
            グリッド吸着
          </button>
          <button
            className={showLayers ? "active" : undefined}
            aria-pressed={showLayers}
            title="レイヤーとCanvasプロパティを開閉"
            onClick={() => setShowLayers((value) => !value)}
          >
            レイヤー
          </button>
        </CanvasToolMenu>
        <div className="canvas-context-tools" aria-label="選択中の操作">
          {editingPanel && (
            <>
              <span className="image-edit-status" role="status">
                画像編集中: {editingPanel.name}
              </span>
              <button
                onClick={() =>
                  savePanel({
                    ...editingPanel,
                    imageScale: 1,
                    imageOffsetX: 0,
                    imageOffsetY: 0,
                    imageRotation: 0,
                  })
                }
              >
                中央へリセット
              </button>
              <button className="active" onClick={finishImageEdit}>
                画像編集を完了
              </button>
            </>
          )}
          {selection && (
            <button
              className="danger"
              aria-keyshortcuts="Delete Backspace"
              disabled={selectedItems.some((item) => item.locked)}
              onClick={deleteSelected}
            >
              {selectedKeys.length > 1
                ? `${selectedKeys.length}件を削除`
                : "選択を削除"}
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
      </div>
      <div className="canvas-stage-row">
        <div
          className={`konva-paper${drawPanelMode ? " drawing" : ""}${editingPanel ? " image-editing" : ""}`}
          onDragOver={(event) => {
            if (
              event.dataTransfer.types.includes("application/x-mangai-asset-id")
            ) {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
            }
          }}
          onDrop={dropAssetOnPanel}
        >
          <Stage
            ref={stageRef}
            width={page.width * scale}
            height={page.height * scale}
            scaleX={scale}
            scaleY={scale}
            onMouseDown={(event) => {
              const stage = event.target.getStage();
              const isPageBackground =
                event.target === stage ||
                event.target.name() === "page-background";
              if (!isPageBackground) return;
              clearSelection();
              if (!drawPanelMode) return;
              const pointer = getPagePointer();
              if (!pointer) return;
              const start =
                snapEnabled && gridSnapEnabled
                  ? snapPointToGrid(pointer, CANVAS_GRID_SIZE)
                  : pointer;
              setPanelDraft({
                start,
                rect: { ...start, width: 0, height: 0 },
              });
            }}
            onMouseMove={updatePanelDraft}
            onMouseUp={finishPanelDraft}
          >
            <Layer>
              <Rect
                name="page-background"
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
              {showGrid &&
                Array.from(
                  { length: Math.floor(page.width / CANVAS_GRID_SIZE) + 1 },
                  (_, index) => index * CANVAS_GRID_SIZE,
                ).map((x) => (
                  <Line
                    key={`grid-v-${x}`}
                    points={[x, 0, x, page.height]}
                    stroke="#5f7f6f"
                    strokeWidth={1 / scale}
                    opacity={0.22}
                    listening={false}
                  />
                ))}
              {showGrid &&
                Array.from(
                  { length: Math.floor(page.height / CANVAS_GRID_SIZE) + 1 },
                  (_, index) => index * CANVAS_GRID_SIZE,
                ).map((y) => (
                  <Line
                    key={`grid-h-${y}`}
                    points={[0, y, page.width, y]}
                    stroke="#5f7f6f"
                    strokeWidth={1 / scale}
                    opacity={0.22}
                    listening={false}
                  />
                ))}
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
                    imageEditing={editingPanelImageId === panel.id}
                    onSelect={(node) => select("panel", panel.id, node)}
                    onBeginImageEdit={(node) => beginImageEdit(panel, node)}
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
                      selected={isSelected("panel", panel.id)}
                      imageEditing={editingPanelImageId === panel.id}
                      onSelect={(node, additive) =>
                        select("panel", panel.id, node, additive)
                      }
                      onBeginImageEdit={(node) => beginImageEdit(panel, node)}
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
                      onSelect={(node, additive) =>
                        select("balloon", balloon.id, node, additive)
                      }
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
                    onSelect={(node, additive) =>
                      select("text", text.id, node, additive)
                    }
                    onMove={(rect) => snapMove(text.id, rect)}
                    onSave={saveText}
                  />
                );
              })}
              {panelDraft && (
                <Rect
                  {...panelDraft.rect}
                  fill="#2f9e6826"
                  stroke="#2f9e68"
                  strokeWidth={3 / scale}
                  dash={[12 / scale, 8 / scale]}
                  listening={false}
                />
              )}
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
                visible={!editingPanelImageId}
                resizeEnabled={
                  !editingPanelImageId &&
                  selectedKeys.length === 1 &&
                  !selectedLayer?.locked
                }
                rotateEnabled={
                  !editingPanelImageId &&
                  selectedKeys.length === 1 &&
                  !selectedLayer?.locked
                }
                anchorSize={12 / scale}
              />
            </Layer>
          </Stage>
        </div>
        {showLayers && (
          <aside className="canvas-layers">
            <h3>レイヤー</h3>
            {layers.map((item, index) => {
              const key = {
                type: item.objectType,
                id: item.id,
              } as SelectionKey;
              const isDragging =
                draggingLayer?.type === key.type && draggingLayer.id === key.id;
              const dropPlacement =
                layerDropTarget?.key.type === key.type &&
                layerDropTarget.key.id === key.id
                  ? layerDropTarget.placement
                  : null;
              return (
                <div
                  className={`canvas-layer-row${isDragging ? " dragging" : ""}${dropPlacement ? ` drop-${dropPlacement}` : ""}`}
                  key={`${item.objectType}-${item.id}`}
                  onDragOver={(event) => {
                    if (!event.dataTransfer.types.includes(LAYER_DRAG_TYPE))
                      return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    const bounds = event.currentTarget.getBoundingClientRect();
                    setLayerDropTarget({
                      key,
                      placement:
                        event.clientY < bounds.top + bounds.height / 2
                          ? "before"
                          : "after",
                    });
                  }}
                  onDrop={(event) => {
                    const sourceText =
                      event.dataTransfer.getData(LAYER_DRAG_TYPE);
                    if (!sourceText) return;
                    event.preventDefault();
                    event.stopPropagation();
                    try {
                      const source = JSON.parse(sourceText) as SelectionKey;
                      const exists = layers.some(
                        (value) =>
                          value.objectType === source.type &&
                          value.id === source.id,
                      );
                      const bounds =
                        event.currentTarget.getBoundingClientRect();
                      if (exists)
                        applyLayerOrder(
                          source,
                          key,
                          event.clientY < bounds.top + bounds.height / 2
                            ? "before"
                            : "after",
                        );
                    } catch {
                      // Ignore malformed data from outside this layer list.
                    } finally {
                      setDraggingLayer(null);
                      setLayerDropTarget(null);
                    }
                  }}
                >
                  <span
                    className="layer-drag-handle"
                    draggable
                    title="ドラッグしてレイヤー順を変更"
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData(
                        LAYER_DRAG_TYPE,
                        JSON.stringify(key),
                      );
                      setDraggingLayer(key);
                    }}
                    onDragEnd={() => {
                      setDraggingLayer(null);
                      setLayerDropTarget(null);
                    }}
                  >
                    ⠿
                  </span>
                  <button
                    className={
                      isSelected(item.objectType, item.id) ? "active" : ""
                    }
                    onClick={(event) => {
                      const node = transformer.current
                        ?.getStage()
                        ?.findOne(`#${item.objectType}-${item.id}`);
                      select(
                        item.objectType,
                        item.id,
                        node ?? null,
                        event.shiftKey,
                      );
                    }}
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
                    onClick={() =>
                      updateLayerState(item, { locked: !item.locked })
                    }
                  >
                    {item.locked ? "🔒" : "◇"}
                  </button>
                  <button
                    disabled={index === 0}
                    title="前面へ"
                    onClick={() => moveLayerStep(item, 1)}
                  >
                    ↑
                  </button>
                  <button
                    disabled={index === layers.length - 1}
                    title="背面へ"
                    onClick={() => moveLayerStep(item, -1)}
                  >
                    ↓
                  </button>
                </div>
              );
            })}
            {selectedLayer && (
              <CanvasProperties
                item={selectedLayer as LayerItem}
                balloons={balloons}
                imageEditing={editingPanelImageId === selectedLayer.id}
                onBeginImageEdit={beginImageEdit}
                onFinishImageEdit={finishImageEdit}
                savePanel={savePanel}
                saveBalloon={saveBalloon}
                saveText={saveText}
              />
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
