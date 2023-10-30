#!/usr/bin/bash
curl -o /tmp/JBMono.zip -L https://download.jetbrains.com/fonts/JetBrainsMono-2.304.zip
unzip /tmp/JBMono.zip -d $HOME/JBMono
mkdir -p $HOME/.local/share/fonts
mv $HOME/JBMono/fonts/ttf/* $HOME/.local/share/fonts/