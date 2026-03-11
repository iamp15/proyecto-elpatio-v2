import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import useChatInventory from '../hooks/useChatInventory';

const COOLDOWN_MS = 10_000;

export default function PlayerChatControls({ onSendChat }) {
  const { t } = useTranslation();
  const { texts, emojis } = useChatInventory();
  const [openMenu, setOpenMenu] = useState(null); // 'text' | 'emoji' | null
  const [cooldown, setCooldown] = useState(false);
  const cooldownTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    };
  }, []);

  const handleSend = (type, content) => {
    onSendChat(type, content);
    setOpenMenu(null);
    setCooldown(true);
    if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    cooldownTimerRef.current = setTimeout(() => {
      setCooldown(false);
      cooldownTimerRef.current = null;
    }, COOLDOWN_MS);
  };

  const openTextMenu = () => !cooldown && setOpenMenu(openMenu === 'text' ? null : 'text');
  const openEmojiMenu = () => !cooldown && setOpenMenu(openMenu === 'emoji' ? null : 'emoji');

  return (
    <div className="absolute bottom-full left-0 mb-2 flex flex-col gap-1.5 z-50 pointer-events-auto">
      <button
        type="button"
        onClick={openTextMenu}
        disabled={cooldown}
        className="w-8 h-8 bg-blue-600 border-2 border-blue-400 rounded-full flex items-center justify-center text-white shadow-md text-base transform hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        💬
      </button>
      <button
        type="button"
        onClick={openEmojiMenu}
        disabled={cooldown}
        className="w-8 h-8 bg-yellow-500 border-2 border-yellow-300 rounded-full flex items-center justify-center text-white shadow-md text-base transform hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        😀
      </button>

      {openMenu && !cooldown && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute left-full bottom-0 ml-2 bg-gray-900/95 border-2 border-gray-600 rounded-lg p-1.5 flex flex-col gap-0.5 shadow-xl backdrop-blur-md"
        >
          {(openMenu === 'text' ? texts : emojis).map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSend(openMenu, item)}
              className="text-left text-white font-bold hover:bg-gray-700 px-2 py-1.5 rounded-md whitespace-nowrap transition-colors text-sm"
            >
              {openMenu === 'text' ? t(item) : item}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
}
