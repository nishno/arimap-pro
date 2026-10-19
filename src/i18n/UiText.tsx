import React from 'react';
import {useLanguage} from '../contexts/LanguageContext';
import {translateUi,formatUiTemplate} from './runtime';
export function UiText({value}:{value:any}){const {language}=useLanguage();return <>{translateUi(value,language)}</>;}
export function UiTemplate({pattern,values}:{pattern:string;values:any[]}){const {language}=useLanguage();return <>{formatUiTemplate(pattern,values,language)}</>;}
export function UiElement({element,labels}:{element:React.ReactElement;labels:Record<string,string>}){const {language}=useLanguage();const props=Object.fromEntries(Object.entries(labels).map(([key,value])=>[key,translateUi(value,language)]));return React.cloneElement(element,props);}
