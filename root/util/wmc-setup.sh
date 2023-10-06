#!/usr/bin/bash
cd $HOME
gsettings set org.gnome.desktop.interface gtk-theme Adwaita-dark && gsettings set org.gnome.desktop.interface gtk-color-scheme prefer-dark
curl -o /tmp/gcm_install.deb -L https://github.com/git-ecosystem/git-credential-manager/releases/download/v2.3.2/gcm-linux_amd64.2.3.2.deb
dpkg -x /tmp/gcm_install.deb $HOME/gcm
alias git-credential-manager='~/gcm/usr/local/bin/git-credential-manager'
export GCM_CREDENTIAL_STORE=cache
git config --global credential.credentialStore cache
$HOME/gcm/usr/local/bin/git-credential-manager configure
git clone https://gitlab.com/htl-villach/informatik/2023-4bhif/wmc/KENDLBACHER $HOME/wmc_kendlbat
curl -o /tmp/JBMono.zip -L https://download.jetbrains.com/fonts/JetBrainsMono-2.304.zip
unzip /tmp/JBMono.zip -d $HOME/JBMono
mkdir -p $HOME/.local/share/fonts
mv $HOME/JBMono/fonts/ttf/* $HOME/.local/share/fonts/
rm $HOME/.config/Code/User/settings.json
curl -o $HOME/.config/Code/User/settings.json -L https://kendlbat.dev/util/wmcsetup/settings.json
code $HOME/wmc_kendlbat