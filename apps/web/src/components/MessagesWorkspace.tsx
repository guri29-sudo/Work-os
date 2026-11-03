import React from 'react';

interface MessagesWorkspaceProps {
  /** On mobile only one pane is visible at a time. */
  showConversationOnMobile: boolean;
  list: React.ReactNode;
  conversation: React.ReactNode;
}

/**
 * Dark two-pane chat card: conversation list (left) + active conversation (right),
 * sitting on a near-black canvas with a soft indigo glow at the top.
 */
export const MessagesWorkspace: React.FC<MessagesWorkspaceProps> = ({
  showConversationOnMobile,
  list,
  conversation,
}) => (
  <div
    data-workspace="messages"
    className="messages-workspace flex-1 min-w-0 h-full overflow-hidden relative bg-[#02020a] flex items-center justify-center p-0 md:p-6 lg:p-10 select-text"
    style={{
      backgroundImage:
        'radial-gradient(ellipse 55% 38% at 50% 0%, rgba(40,36,140,0.55) 0%, rgba(20,18,80,0.28) 45%, rgba(2,2,10,0) 100%)',
    }}
  >
    <div className="flex w-full h-full max-w-[1024px] max-h-[720px] md:rounded-[28px] bg-[#1b1b1f] p-0 md:p-1 md:border md:border-[#2a2a30] overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
      <aside
        className={`${showConversationOnMobile ? 'hidden' : 'flex'} md:flex w-full md:w-[262px] shrink-0 flex-col md:rounded-l-[24px] bg-gradient-to-b from-[#1e1e23] to-[#131316]`}
      >
        {list}
      </aside>
      <section
        className={`${showConversationOnMobile ? 'flex' : 'hidden'} md:flex flex-1 min-w-0 flex-col md:rounded-[24px] bg-[#03030a] overflow-hidden`}
      >
        {conversation}
      </section>
    </div>
  </div>
);
