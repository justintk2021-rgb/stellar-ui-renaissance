import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { ReactNodeViewProps } from "@tiptap/react";
import { StudyTradeCard } from "./StudyTradeCard";
import { useStudyEditorData } from "./studyEditorData";

function TradeNodeView({ node }: ReactNodeViewProps) {
  const { trades, playbooks } = useStudyEditorData();
  const tradeId = String(node.attrs.tradeId || "");
  return (
    <NodeViewWrapper className="my-3" data-study-trade={tradeId}>
      <StudyTradeCard tradeId={tradeId} trades={trades} playbooks={playbooks} />
    </NodeViewWrapper>
  );
}

function YoutubeNodeView({ node }: ReactNodeViewProps) {
  const videoId = String(node.attrs.videoId || "");
  return (
    <NodeViewWrapper className="my-3" data-study-youtube={videoId}>
      <div className="aspect-video overflow-hidden rounded-xl border border-border/50 bg-black/40">
        {videoId ? (
          <iframe
            className="h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`}
            title="YouTube video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : null}
      </div>
    </NodeViewWrapper>
  );
}

export const StudyTradeNode = Node.create({
  name: "studyTrade",
  group: "block",
  atom: true,
  draggable: false,
  selectable: true,
  addAttributes() {
    return { tradeId: { default: null } };
  },
  parseHTML() {
    return [{ tag: "div[data-study-trade]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-study-trade": HTMLAttributes.tradeId ?? "" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(TradeNodeView);
  },
});

export const StudyYoutubeNode = Node.create({
  name: "studyYoutube",
  group: "block",
  atom: true,
  selectable: true,
  addAttributes() {
    return { videoId: { default: null } };
  },
  parseHTML() {
    return [{ tag: "div[data-study-youtube]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-study-youtube": HTMLAttributes.videoId ?? "" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(YoutubeNodeView);
  },
});
