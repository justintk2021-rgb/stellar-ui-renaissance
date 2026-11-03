import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { ReactNodeViewProps } from "@tiptap/react";
import { StudyTradeCard } from "./StudyTradeCard";
import { useStudyEditorData } from "./studyEditorData";

function TradeNodeView({ node }: ReactNodeViewProps) {
  const { trades, playbooks, onOpenJournal, onOpenPlaybook } = useStudyEditorData();
  const tradeId = String(node.attrs.tradeId || "");
  return (
    <NodeViewWrapper className="my-3" data-study-trade={tradeId}>
      <StudyTradeCard
        tradeId={tradeId}
        trades={trades}
        playbooks={playbooks}
        onOpenJournal={onOpenJournal}
        onOpenPlaybook={onOpenPlaybook}
      />
    </NodeViewWrapper>
  );
}

function YoutubeNodeView({ node }: ReactNodeViewProps) {
  const videoId = String(node.attrs.videoId || "");
  const src = String(node.attrs.src || "");
  return (
    <NodeViewWrapper className="my-3" data-study-youtube={videoId || src}>
      <div className="aspect-video overflow-hidden rounded-xl border border-border/50 bg-black/40">
        {src ? (
          <video className="h-full w-full" src={src} controls playsInline />
        ) : videoId ? (
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
    return {
      videoId: { default: null },
      src: { default: null },
    };
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
