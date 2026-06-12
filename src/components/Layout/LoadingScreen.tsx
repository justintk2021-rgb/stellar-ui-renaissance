import { motion } from "framer-motion";

/**
 * Full-screen boot loader shown after login while the dashboard loads
 * behind it. Spinner from Uiverse.io by mrhyddenn.
 */
export function LoadingScreen() {
  return (
    <motion.div
      key="boot-loading-screen"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5, ease: "easeOut" } }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 bg-background"
    >
      <div className="relative">
        <div className="boot-spinner" />
        <div className="boot-spinnerin" />
      </div>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-sm text-muted-foreground tracking-wide"
      >
        Loading your dashboard…
      </motion.p>
    </motion.div>
  );
}
