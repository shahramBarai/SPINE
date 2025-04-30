import React from "react";

const ConnectionLine = ({
  fromX,
  fromY,
  toX,
  toY,
}: {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}) => {
  return (
    <g>
      <path
        fill="none"
        strokeWidth={1.5}
        className="animated stroke-primary"
        d={`M${fromX},${fromY} C ${fromX} ${toY} ${fromX} ${toY} ${toX},${toY}`}
      />
      <circle
        cx={toX}
        cy={toY}
        fill="#fff"
        r={3}
        strokeWidth={1.5}
        className="stroke-primary"
      />
    </g>
  );
};

export default ConnectionLine;
