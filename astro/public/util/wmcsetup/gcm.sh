#!/usr/bin/bash
curl -o /tmp/gcm_install.deb -L https://github.com/git-ecosystem/git-credential-manager/releases/download/v2.3.2/gcm-linux_amd64.2.3.2.deb
dpkg -x /tmp/gcm_install.deb $HOME/gcm
alias git-credential-manager='~/gcm/usr/local/bin/git-credential-manager'
echo alias git-credential-manager='~/gcm/usr/local/bin/git-credential-manager' >> $HOME/.bashrc
export GCM_CREDENTIAL_STORE=cache
git config --global credential.credentialStore cache
git config --global user.name "Tobias Kendlbacher"
git config --global user.email "kendlbat@edu.htl-villach.at"
$HOME/gcm/usr/local/bin/git-credential-manager configure
git clone https://gitlab.com/htl-villach/informatik/2024-5bhif/wmc/KENDLBACHER $HOME/wmc_kendlbat
while [ ! -f $HOME/.local/share/fonts/JetBrainsMono-Regular.ttf ]; do sleep 1; done
code $HOME/wmc_kendlbat
