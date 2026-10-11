import {emptyBoard,type Board} from './model';
import type {InkData} from './ink-model';
export type HandwritingBoard=Board&{presentation:'handwriting';ink:InkData};
export function createHandwritingBoard():HandwritingBoard{return {...emptyBoard(),version:3,presentation:'handwriting',ink:{version:1,strokes:[]}};}
export function isHandwritingBoard(board:Board|undefined):board is HandwritingBoard{return board?.presentation==='handwriting';}
