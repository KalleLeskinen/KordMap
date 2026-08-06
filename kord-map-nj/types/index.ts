//data model

export type MapScaleValue = number | Array<number | string>;

export interface PointData {
    id: string;
    floor: string;
    x: number;
    y: number;
    iconType: string;
    details?: string;
    image?: string | null;
}

export interface MapConfig {
    name: string;
    floors: string[];
    icons: string[];
    mapScale?: MapScaleValue;
}