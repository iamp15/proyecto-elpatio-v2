import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export default function ChatBubble({ bubble, isOpponent }) {
  const { t } = useTranslation();

  if (!bubble) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.5, y: isOpponent ? -20 : 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ type: 'spring', bounce: 0.5 }}
        className={`absolute ${isOpponent ? 'top-full mt-3' : 'bottom-full mb-3'} left-1/2 -translate-x-1/2 z-50 bg-white border-2 border-gray-300 rounded-2xl px-4 py-2 shadow-xl whitespace-nowrap pointer-events-none`}
      >
        <div className={`absolute ${isOpponent ? 'bottom-full mb-[-2px]' : 'top-full mt-[-2px]'} left-1/2 -translate-x-1/2 border-8 border-transparent ${isOpponent ? 'border-b-white' : 'border-t-white'}`} />

        <span className={bubble.type === 'emoji' ? 'text-3xl' : 'text-sm font-bold text-gray-800'}>
          {bubble.type === 'text' ? t(bubble.content) : bubble.content}
        </span>
      </motion.div>
    </AnimatePresence>
  );
}
