'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface CardProps {
  isFlipped: boolean;
  vote: string | null;
}

const Card: React.FC<CardProps> = ({ isFlipped, vote }) => {
  const variants = {
    flipped: {
      rotateY: 180,
    },
    unflipped: {
      rotateY: 0,
    },
  };

  return (
    <motion.div
      className="card-container"
      variants={variants}
      animate={isFlipped ? 'flipped' : 'unflipped'}
      transition={{ duration: 0.6 }}
    >
      <div className="card-face card-front">
        <div className="poker-card-back">
          <div className="poker-card-back-inner" />
        </div>
      </div>
      <div className="card-face card-back">
        {vote || '?'}
      </div>
    </motion.div>
  );
};

export default Card;
