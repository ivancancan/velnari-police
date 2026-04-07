import React from 'react';

export const Map = ({ children }: { children?: React.ReactNode }) => (
  <div data-testid="map-container">{children}</div>
);

export const Marker = ({
  children,
  latitude,
  longitude,
}: {
  children?: React.ReactNode;
  latitude: number;
  longitude: number;
}) => (
  <div data-testid={`marker-${latitude}-${longitude}`}>{children}</div>
);

export const NavigationControl = () => <div data-testid="nav-control" />;

export default Map;
