---
title: 11.x release notes
product: Unity Version Control
canonical: https://docs.unity.com/en-us/unity-version-control/release-notes/11
last_updated: 2026-11-03
generated_at: 2026-11-04T04:32:09.704Z
locale: en-us
---

# 11.x release notes

> Review release notes for version 11 of Unity Version Control.

This document contains all release notes for Unity Version Control major version 11.x, organized from newest to oldest.

## 11.0.16.10570

> **Note:**
>
> **Public** | 2026/10/29

### New

#### All platforms - All clients: Token-based authentication for UPWorkingMode

Servers configured with UPWorkingMode (`users.conf` and `groups.conf`) answer the login with a token, as LDAP servers already do. The client keeps the user and the password in `client.conf` or in the connection profile and caches the token in `tokens.conf`, so the password hash is no longer sent on every call. The client renews an expired token automatically, and replaces a token that the server rejects with a new one from the stored password, without asking for credentials again.

`cm configure` and `cm profile create` accept `--token` together with `--password` on UPWorkingMode: the password goes to the configuration and the token to `tokens.conf`.

```text
cm configure --language=en --workingmode=UPWorkingMode --user=john --password=secret --token=<token> --server=myserver:8087
```

`cm passwd` discards the cached token and gets a new one for the new password. Older servers keep working as before: they answer with the password hash and the client uses it on every call.

Refer to [cm configure](/unity-version-control/uvcs-cli/configureclient.md) and [cm passwd](/unity-version-control/uvcs-cli/changeuserpassword.md).

#### All platforms - Desktop GUI: Toggle to turn off branch colors in the Branch Explorer

The **Advanced filters & format** options of the **Branch Explorer** now include an On/Off toggle for branch colors, in the same row as the **Add inclusion**, **Add exclusion**, and **Add format** buttons. When it's off, the **Branch Explorer** draws every branch in the default color, and keeps your format rules. Turning it on again brings the rule colors back. This helps when taking screenshots to share, since branch colors set for personal use can confuse other people.

#### Windows, Linux - Desktop GUI: plastic:// links open in the running Desktop GUI

When the Desktop GUI is already running, opening a `plastic://` link, such as a diff or file link shared in a browser or a chat, now opens it in that running instance instead of starting a new one. A file link reuses the workspace window that is already open for its repository.

#### All platforms - Command-line: `cm patch` no longer needs GNU Diff

`cm patch` now calculates the differences itself, so creating a patch no longer requires GNU Diff to be installed. Applying a patch with `cm patch --apply` still uses the Patch tool.

Patches now use the git diff format, so moved files show up as renames instead of a full delete and add. Applying a patch that renames files needs GNU Patch 2.7 or later.

Changed binary files are now only listed, as `Binary files a/<path> and b/<path> differ`, which keeps the patch small and readable. To include their content, so that applying the patch also restores the binary files, add `--include-binaries`:

```text
cm patch cs:4@default --output=changes.patch
cm patch cs:4@default --include-binaries --output=changes.patch
```

Refer to [cm patch](/unity-version-control/uvcs-cli/patch.md).

#### All platforms - Command-line: `cm status --format` prints changes with a custom format

`cm status` accepts a `--format` option that prints one line for every pending change, with the placeholders of the template replaced. It lists the same changes and status codes as `--machinereadable`, and adds the size, the last modification date, the item type, and the file type, which no other compact output includes. This makes it easy to read the status of large workspaces from scripts and tools without parsing the much larger `--xml` output.

```text
cm status --format="{status}{tab}{size}{tab}{relativepath}"
CH	1532	/src/main.c
AD	240	/docs/readme.txt
```

`--format` prints only the changes, without the workspace status, so it doesn't contact the server. Refer to [cm status](/unity-version-control/uvcs-cli/workspacestatus.md).

#### All platforms - Server: Personal Access Tokens in UPWorkingMode

UPWorkingMode servers support personal access tokens (PATs). `cm accesstoken create`, `list`, `reveal`, and `revoke`, and the REST endpoints, work once the feature is enabled in `server.conf`:

```xml
<AccessTokensSettings>
  <Enabled>true</Enabled>
  <AccessTokenLifespan>180.00:00:00</AccessTokenLifespan>
  <AllowedUsers>all</AllowedUsers>
</AccessTokensSettings>
```

From the client, you can use a PAT on its own as the credential, for example `cm repo list --workingmode=UPWorkingMode --token=<pat> --server=myserver:8087`. Git access over HTTP with a PAT isn't available yet on UPWorkingMode servers.

### Bug

#### All platforms - Desktop GUI: Task IDs now sort by number in the task lists

Sorting the **ID** column of the pending tasks list, in the **Create branch** dialog (**From task** tab) and in the **Select issues from** dialog, compared IDs as text, so task 192 appeared after task 1243. The column now sorts IDs by their numeric value in both directions, and lists IDs that aren't plain numbers after the numeric ones.

#### All platforms - Desktop GUI: Fixed diff view jumping back when scrolled horizontally

In the side-by-side diff, scrolling down while the view was scrolled horizontally could make it jump back several lines when a long line left the view. The left and right panels could also end up a few columns apart until the horizontal scrollbar was dragged again. Both panels now keep their vertical position and stay aligned horizontally.

#### All platforms - Desktop GUI: **Go to moved code** now scrolls to the moved method

In the semantic diff, a method that moved within a file shows a moved icon in both panes. Choosing **Go to moved code** from the left pane scrolled both panes to the first line instead of to the method's new location on the right. It now scrolls to the moved method.

#### All platforms - Gluon: Fixed check-in failing after renaming a folder with changes inside

Checking in a folder rename together with changes to items inside that folder (renamed, modified, or added files) failed at the end of the operation with an error like "The given key '13566' was not present in the dictionary." The check-in was rolled back, and the only workaround was to split it into several check-ins. This affected both Gluon and `cm partial checkin`. These check-ins now complete successfully.

#### All platforms - Command-line: Fixed `cm shell` failing to write output to a file

When running `cm shell` with `--shelloutputfile`, commands that download many files, such as `switch` or `update`, could randomly fail with "Destination is too short", or make the whole `cm shell` exit with "Unable to translate Unicode character ... to specified code page". This no longer happens.

#### All platforms - Server: Fixed valid tokens refused while a repository is being deleted

While a repository was being deleted, the server could reject the authentication of a valid user or token for unrelated requests from other users of the same organization. This no longer happens.

#### All platforms - TeamCity plugin: Checkout rules with path transformations now applied in agent-side checkout

With agent-side checkout (**Always checkout files on agent**), the plugin ignored checkout rules that mapped a repository path to a different location (for example, `+:src => code`). These rules are now applied, so agent-side checkout produces the same directory structure as server-side checkout.

#### All platforms - TeamCity plugin: The `cloaked.conf` file is no longer deleted from the agent's workspace

With agent-side checkout, the plugin deleted the `cloaked.conf` file from the agent's working directory when the build configuration had no checkout rules. The file is now preserved between builds.

***

## 11.0.16.10512

> **Note:**
>
> **Public** | 2026/10/22

### New

#### All platforms - Command-line: Resolve merge conflicts on disk with conflict markers

`cm merge --conflict-markers` finishes a merge that has text file conflicts without opening a merge tool. It writes each conflict into the workspace file between standard diff3 conflict markers, so you can resolve it in a text editor, from a script, or with a coding agent that can't drive a GUI. `cm checkin` refuses the check-in while a file still contains markers.

```text
cm merge br:/main/task001 --merge --conflict-markers
```

Refer to [cm merge](/unity-version-control/uvcs-cli/merge.md).

#### All platforms - Command-line: Code review comments and reviewers in `cm codereview`

`cm codereview` (`cm cr`) has three new subcommands that work on branch, changeset, and shelve reviews:

* `comment` adds, replies to, edits, and deletes review comments, on the whole review or on a line of a file.
* `reviewer` adds, removes, and lists the reviewers of a review.
* `review` sets your own review status, or asks reviewers to review again.

```text
cm cr comment add 1367 -c="Rename this" --path=/src/foo.cs --line=42
cm cr review 1367 --re-request --all
```

Refer to [cm codereview](/unity-version-control/uvcs-cli/codereview.md).

#### All platforms - Command-line: Set reviewers and change titles with `cm codereview`

`cm codereview` sets the reviewers of a new review with `--users` and `--groups`.

`cm codereview -e` changes the title of a review with `--title`.

Refer to [cm codereview](/unity-version-control/uvcs-cli/codereview.md).

#### All platforms - Command-line: `line` field in `cm find changereviewcomment`

`cm find changereviewcomment` prints and filters by `line`, which counts from 1, like a text editor and the `--line` option of `cm cr comment add`.

The filter accepts `=` and `!=`.

`location` keeps the stored value, which counts from 0. `line` is empty for comments that aren't on a line of a file.

```text
cm find changereviewcomment "where reviewid=1367 and line=106" --format="{guid} {type} line {line}"
```

#### All platforms - Command-line: Edit the comment of a branch or a label

`cm branch editcomment` and `cm label editcomment` replace the comment of an existing branch or label, in the same way that `cm changeset editcomment` does for changesets. Editing a label comment leaves the label on the changeset it's applied to.

**Behavior change:** `edit` is an alias for `editcomment`, so `cm branch edit` and `cm label edit` now edit a comment instead of creating a branch or label named "edit". To create a branch or label, use `cm branch create edit` or `cm label create edit`.

Refer to [cm branch editcomment](/unity-version-control/uvcs-cli/branch-editcomment.md) and [cm label editcomment](/unity-version-control/uvcs-cli/label-editcomment.md).

#### All platforms - Command-line: `cm changeset editcomment` reads the comment from a file

`cm changeset editcomment` can now read the new comment from a file with `-commentsfile`, and an empty comment (`""`) clears the comment.

Refer to [cm changeset editcomment](/unity-version-control/uvcs-cli/changeset-editcomment.md).

#### All platforms - Command-line: Faster commands that print user names

`cm find`, `cm history`, `cm annotate`, and `cm repo list` now resolve all the user names they print in a single request to the server, instead of one request for each user.

Commands that list many objects owned by different users run several times faster. For example, listing the branches of a large repository with their owners (or with `--xml`) takes about 1.5 seconds instead of 9. The output is unchanged.

### Bug

#### All platforms - Desktop GUI: Fixed links misaligned with the surrounding text

Links in Desktop GUI messages now line up with the surrounding text.

Previously, the following were displayed below the rest of the sentence:

* The **pending changes view** and **here** links in the "Merge finished" message of the **Merge** view.
* The changeset link in the check-in notification.
* The shelve link in the shelve notification.

#### All platforms - Desktop GUI: Fixed empty tips panel

The **Tips** panel now closes correctly even when its view isn't visible. Previously, if a tip closed while you were in another view, going back to that view showed an empty panel with only the **Disable all tips** checkbox and the **OK** button.

For example, this happened after a check-in from the **Workspace Explorer** refreshed the **Pending Changes** view, or when a tip closed on its own after a few minutes.

#### All platforms - Command-line: Fixed `cm changeset editcomment` changing comments when its arguments are invalid

`cm changeset editcomment` now keeps a comment such as "Is it ready?" as typed, instead of expanding it as file names. When words are left over, as with an unquoted `Fix the login timeout`, or when an option takes the place of the comment, the command now shows its usage and leaves the comment unchanged.

Previously, it kept only the first word, or cleared the comment.

#### Windows - Command-line: Fixed slow `cm shell` startup on Cloud Edition

On Cloud Edition, `cm shell` now executes its first command in about 0.3 seconds, even when multiple shells start at the same time. Previously, it took 3–4 seconds, or about 9 seconds with several shells. This also speeds up the startup of IDE plugins and other tools that rely on `cm shell`.

#### All platforms - Command-line: Fixed Unity organizations shown as IDs in `cm` output

`cm` now shows Unity organizations by name (`repo@MyOrg@unity`) in all its output.

Previously, the following outputs printed them as numeric IDs (`repo@1375488836673@cloud`):

* `cm status --xml`
* `cm status --wkconfig --cset`
* `cm history --xml`
* The xlink items of `cm merge --xml`
* The name field of `cm profile list --format`
* Several error messages.

The XML layout is unchanged, so tools that parse it keep working.

`cm profile delete` also accepts the organization name of a Unity organization profile.

***

## 11.0.16.10484

> **Note:**
>
> **Public** | 2026/10/15

### Bug

#### Windows - All clients: Fixed failure when renewing an expired token in parallel

When several commands renewed an expired token at the same time, some of them failed with "The process cannot access the file '...\tokens.conf' because it is being used by another process."

This happened, for example, when a client ran several `cm` commands at startup.

Now, a command that saves `tokens.conf` waits while another process is reading it, so the save no longer fails.

#### All platforms - SemanticMerge: Fixed automatic merge dropping members of a new interface

An automatic semantic merge could leave a newly added interface empty by silently dropping its member declarations without reporting a conflict. This happened when the source contributor also moved a member from one interface to another.

The merge now keeps the members of the new interface.

#### All platforms - Server: Fixed initial check-in with a custom `blobspath`

Before, the first check-in to a newly created repository failed when setting `blobspath` in `jet.conf` to a path outside the server's default storage, such as a dedicated disk or a network share. The server created the repository's metadata folder but not the matching blob folder at the custom location, so it couldn't write the blob index file and the check-in failed.

The server now creates the repository's blob folder when the repository is created, so the initial check-in succeeds with any `blobspath`. Repositories using the default (empty) `blobspath` are unaffected.

***

## 11.0.16.10468

> **Note:**
>
> **Public** | 2026/10/08

### New

#### Linux - Installers: New repositories for UVCS Linux packages

UVCS Linux packages are now published in new Debian and RPM repositories, which replace the legacy ones.
Some modern distributions (such as Debian 13, Fedora 43, and later) rejected installs from the legacy repositories due to deprecated signature algorithms.
The new repositories use updated signing standards and are signed under the "Unity Technologies ApS" identity.

Refer to [Install Unity Version Control on Linux](/unity-version-control/install-uvcs-on-linux.md) for updated instructions.

If you are migrating from the legacy repositories, note:

* Fedora: Use `dnf upgrade` instead of `dnf install`.
* SUSE: Pass `--allow-vendor-change` flag to the `zypper install` command.

#### All platforms - All clients: Skip compression for well-known already-compressed file formats

Until now, check-in tried to ZLib-compress every file unless a `compression.conf` rule excluded it, including files whose format is already compressed. Re-compressing already-compressed content makes the operation slower and consumes more resources (CPU and memory during the check-in), only to produce data that is the same size or slightly bigger.

Check-in now automatically skips compression for well-known already-compressed formats, with no configuration needed:

* **Images**: .jpg, .jpeg, .png, .gif, .webp, .avif, .heif, and more
* **Video**: .mp4, .mkv, .avi, .mov, .webm, and more
* **Audio**: .mp3, .aac, .ogg, .wma, .flac, and more
* **Archives**: .zip, .gz, .bz2, .xz, .7z, .rar, .zst, and more
* **Documents**: .docx, .xlsx, .pptx, .pdf, .odt, .ods
* **Packages and fonts**: .unitypackage, .apk, .jar, .nupkg, .woff2, and more

These formats always skip compression, even if a `compression.conf` rule says otherwise. Your rules keep applying to every other extension. Importing from Git already behaved this way, and the regular check-in flow now matches it.

#### All platforms - All clients: `--token` no longer overwrites `tokens.conf`

Passing `--token` on the command line made the client write the supplied token to `tokens.conf`,
replacing the entry stored for that server and user. A one-off command run under a different
identity, such as a CI job or a service account, left its token behind in the local store.

The client now keeps a token passed with `--token` in memory for the lifetime of that single
command and leaves `tokens.conf` alone. This applies to the default file and to one set with
`--tokensconf`. Tokens the client obtains by renewing or re-authenticating during that command
stay in memory too.

`cm configure` and `cm profile create` still write the token, because storing credentials is what
those commands are for.

#### All platforms - Desktop GUI: Show in Branch Explorer in changesets, branches and labels views

The context menu of the Changesets, Branches and Labels views now includes a **Show in Branch Explorer** option. It switches to the Branch Explorer and centers the diagram on the selected changeset, branch or label.

When the object is older than the current date filter, the view widens the filter automatically so the object becomes visible. If the object still cannot be displayed (for example, a branch or user filter excludes it), the previous date filter is restored and a warning dialog explains that the object is not visible with the current filters.

#### All platforms - Desktop GUI: The object you navigate to is centered and selected

Navigating to a changeset, branch or label in the Branch Explorer now always centers it in the diagram instead of leaving it near the edge of the visible area, selects it as if it had been clicked, and gives the focus to the diagram, so the keyboard navigation continues from that object.

The Branch Explorer also selects the object again after refreshing, so a branch or a label created or renamed from its context menus is centered and selected when the diagram reloads.

#### All platforms - Desktop GUI: Switch to the reviewed branch from the Code Reviews view

The context menu of the Code Reviews view now has a new **Switch workspace to this branch** option. It switches the workspace to the branch of the selected code review, which saves looking the branch up in the Branches view or the Branch Explorer before building or testing the changes under review.

#### All platforms - Desktop GUI: Review comments sorted by date in the code review window

The **Review comments summary** in the **Review changes** tab of the code review window now has a new **Date modified** column in the lists of change requests, questions and comments. It shows when each comment was written or last edited. The lists are sorted by this column by default, newest first, so the latest feedback is at the top. Before, they were sorted alphabetically by the comment text.

#### All platforms - Desktop GUI: Collapsible sidebar in the code review window

The sidebar of the code review window now shows the name of each tab, **Overview** and **Review changes**, next to its icon, in the same style as the workspace window sidebar.

The **Overview** tab has a new icon that better represents its contents.

A button at the bottom of the sidebar collapses it to show only the icons, and expands it again. The collapsed or expanded state is remembered, so the code review windows opened later use it.

#### All platforms - Command-line: Resolve merge-to file conflicts from a file

`cm merge --to` takes the resolution of each conflicting file from a JSON file with the new `--fileconflictsresolutionsfile` option, without asking. For each file, the resolution either keeps the source or destination revision, or uses the content of a file that is already merged. Conflicts not listed in the file are resolved as before, for example with `--keepdestination`. This lets tools that resolve conflicts in their own UI finish a server-side merge with `cm`.

```text
$> cm merge br:/main/task001 --to=br:/main --merge --fileconflictsresolutionsfile=/tmp/resolutions.json
```

```json
{
  "resolutions": [
    { "path": "/src/Player.cs", "resultFile": "/tmp/merged/Player.cs" },
    { "path": "/art/logo.png", "keep": "source" },
    { "path": "/README.md", "keep": "destination" }
  ]
}
```

Each `path` is the conflicting file's path as `cm merge --to --machinereadable` prints it in its `FILE_CONFLICT` line, including files inside writable xlinks. If any resolution is not valid, the merge stops before anything is uploaded and names the wrong entry. The option also works with `--shelve` and shelve sources. `cm` never changes or deletes the resolutions file or the result files.

#### All platforms - Server: Smart Locks support moving changesets and promoting branches

Moving changesets to another branch and promoting a branch now keep Smart Locks up to date. A retained lock follows its changesets to the new branch, so it still protects the asset there. The lock is released when the changesets reach the lock's destination branch, either through the promote itself or through a later merge.

Promoting a branch also moves any locks the branch still holds to its parent, so no lock is left on the deleted branch.

Moving or promoting changesets that change an item someone has exclusively checked out is not allowed. The operation fails and lists the locked items.

### Bug

#### All platforms - Desktop GUI: Fixed check-in failing in tree view with repeated folder names

The Pending Changes view built a wrong hierarchy when **view as tree** was enabled and the workspace contained a folder with the same name as one of its parent folders, such as `Assets/MyPackage/TPS/Assets`. An extra top-level folder appeared next to the real root, one item went missing from the view, and the check-in failed with the error "An item with the same key has already been added". The only way around it was to switch back to the list view.

The tree now nests those folders under their real parent, and the check-in completes.

#### All platforms - Desktop GUI: Fixed "Manual conflict resolution" ignored when a premerge tool runs first

Ticking **Manual conflict resolution** in the merge options had no effect on files whose configured merge tool chain began with a premerge tool. The chain stopped at the first tool that exited successfully, so UnityYAMLMerge running with `-p` auto-merged the file and the interactive tool at the end of the chain never opened. The conflict ended up resolved without the user ever seeing it. This affected the typical Unity setup for `.prefab` and `.unity` files.

With **Manual conflict resolution** ticked, the merge now skips the earlier entries of the chain and runs only the last tool, so the interactive tool opens for every conflicting file. Single-tool chains and the default automatic mode behave exactly as before.

#### All platforms - Desktop GUI: Tabs now align text to tab stops

Text after a tab did not line up in the file viewers, because every tab moved the text a fixed distance instead of up to the next tab stop. Code or comments aligned with tabs looked misaligned compared to a code editor.

Tabs now expand to the next multiple of the configured tab size, as in a code editor. This applies to the content view in **Pending changes**, the diff viewer and the merge tool, whether or not the whitespace glyphs are shown.

#### All platforms - Desktop GUI: Code Review "Show pending to integrate" no longer ignored when switching tabs

In the Code Review window, switching from **Review changeset by changeset** back to **Review entire
branch** listed all the branch changes again, even with **Show pending to integrate** checked. The
button had to be unchecked and checked again to filter the list. The selected option is now kept
when switching between both review modes.

#### All platforms - Desktop GUI: Code Review "Show pending to integrate" changes updated on refresh

In the Code Review window, the changes shown with **Show pending to integrate** checked were calculated once and were not updated when the review was refreshed, so the list could keep an outdated set of changes.

Refreshing the review now recalculates the changes pending to integrate and shows them again, keeping the **Show pending to integrate** selection.

Switching back to **Review entire branch** is also faster on branches that have nothing pending to integrate. The window asked the server whether the branch had changes to integrate every time the branch changes were displayed; it now asks once per review, and again when the review is refreshed.

#### All platforms - Server: Fixed check-in failing for cross-organization xlinks

Previously, checking in a change to a file inside a writable xlink could fail with `The specified repository couldn't be found` when the xlinked repository was in a different cloud organization from the workspace and both organizations were hosted on the same server. The server reported one identity for every organization it hosted, so the check-in resolved the xlinked repository against the workspace's organization instead of the xlink's own.

The server now reports a distinct identity per organization, so the xlinked repository resolves against its own organization and the check-in succeeds. The fix is server side and needs no client update.

#### All platforms - Cloud Server: Fixed REST API token rejected if org name casing differs

REST API calls made with a token from the `/login` endpoint failed with a 401 "An invalid user api token was provided" error when the organization name in the login URL used a different casing than the stored name (for example, `myorg` instead of `MyOrg`). The login endpoints now store the organization name with its correct casing in the token, so later calls with that token succeed.

#### All platforms - Unity VCS Tray: Fixed a second agent starting when one is already running

Launching the UVCS Tray agent while another one was already running started a second agent. On Windows, both agents then tried to mount the same dynamic workspaces on the same paths. The mount failed with a "Directory moved from mount path" error and renamed the existing workspace directories, appending a "\~moved1" suffix.

Starting the UVCS Tray agent with no arguments while another one is already running now does nothing. The running agent still handles commands such as opening a Cloud Drive link or starting a dynamic workspace.

***

## 11.0.16.10371

> **Note:**
>
> **Public** | 2026/08/20

### New

#### All platforms - Desktop GUI: Show hidden branches in the Branch Explorer

The Branch Explorer now has a new **Show hidden** toggle button inside the **Other** filter. When enabled, hidden branches appear in the diagram at reduced opacity, alongside regular ones.


**The Branch Explorer with the new 'Show hidden' filter enabled and a hidden branch displayed:**
![The Branch Explorer with the new 'Show hidden' filter enabled and a hidden branch displayed](/api/media?file=/unity-version-control/media/images/release-notes/img/a1b47c65c111497f5ae38346381cba1ef5ae9e79191409f44e8740fc0f295fba.png)

#### All platforms - Desktop GUI: Enable the merge to operation when you are not in a workspace

The **Merge to** operation merges a source branch, changeset, or label into a destination branch directly on the server, without loading the source into your workspace.

Until now the option was disabled in the context menus whenever no workspace was active, even though the operation does not need one. It is now available in those menus.
You can start a merge to operation from the right-click menu of the following items:

* Branches: right-click a branch and select **Merge to**.
* Changesets: right-click a changeset and select **Merge to**.
* Labels: right-click a label and select **Merge to**.

The same operation is available from the command line with the `--to` (or `--destination`) option:

```console
$> cm merge br:/main/task001@myrepo@myserver:8087 --to=br:/main/release@myrepo@myserver:8087 --merge
Merging from br:/main/task001 to br:/main/release
Merge finished successfully.
```

### Bug

#### All platforms - Desktop GUI: Diff view no longer freezes on files with a very long line

Previously, opening a diff of a file that contained a single extremely long line, such as a Unity YAML asset with an inline binary blob serialized as hex on one line, froze the application for several seconds when that line scrolled into view. The editor measured and highlighted the whole line on the UI thread.
The editor no longer processes the entire line. It renders the first few thousand characters followed by a truncation marker, so scrolling stays responsive.

#### All platforms - Desktop GUI: Fixed crash when a block selection crosses the diff splitter

Before, holding the block selection modifier and dragging the mouse from one pane of a
side-by-side diff across the center splitter into the other pane crashed the application.
The diff now keeps rendering correctly during the drag and the application stays open.

Hold **Alt** (macOS: **Ctrl**) and drag to make a block selection.

Both diff surfaces were affected:

* **Embedded diff**: The diff shown inside the main window, for example from the Pending
  Changes or Changesets views.

* **Diff in a new window**: The diff opened as a separate window.

#### All platforms - Desktop GUI: The shelves list now shows correct information

Previously, the **Shelves** panel in the **Pending Changes** tab kept showing the values it read when the list was first loaded. A shelve created the day before could still say **Just now**, and refreshing the view did not correct it.

The shelves list now redraws its rows every time it is refreshed, so the dates match the age of each shelve.

***

## 11.0.16.10350

> **Note:**
>
> **Public** | 2026/08/12

### New

#### All platforms - Desktop GUI: Show attributes in Code Review window

The **Code Review** window now displays the attributes of a branch or changeset next to the **Conversation** panel. Reviewers can read attribute values without switching to the **Branch Explorer**.

The attributes are shown with the same components used in the Branch Explorer, so they can be added, edited, and removed from the panel in the same way.


**Screenshot of a Code Review window including the new attributes panel:**
![Screenshot of a Code Review window including the new attributes panel](/api/media?file=/unity-version-control/media/images/release-notes/img/4ee8e13c176fc7d9c65b9810fbe1c75400fb1b6a4c704efb133e3b6c39f961ca.png)

### Bug

#### All platforms - CLI : `cm changelist add` no longer deletes the target changelist when adding a file that was checked out and changed

Rebuilding a chagelist after adding a checked-out and changed file reset the changelists's contents. This was because files carrying the `CheckedOut` change type had two IDs: One for the entry key and one for all other uses.

#### All platforms - Command-line : `cm status --xml` reports the combined `CO+RP` and `CO+CP` status codes

When applying a shelve to a workspace, an item can be checked out and replaced, or checked out and copied as a new file.

`cm status --machinereadable` already reported these as `CO+RP` and `CO+CP`, but `cm status --xml` reported only `CO`, so a tool parsing the XML can't tell a replaced revision from a copied one.

The `Type` field in the XML output now carries the combined code and matches the machine-readable output. The `--short` and `--compact` text output report the same codes.

The `Type` field distinguishes these states:

* `CO+RP`: The item is checked out and its revision was replaced, for example after applying a shelve.
* `CO+CP`: The item is checked out and is a copy. That is, it's a new file.
* `CO+CH`: The item is checked out with local changes. This code already worked and is listed here for contrast.

A replaced or copied item that is not checked out still reports `RP` or `CP`.

```text
$> cm status --xml
<StatusOutput>
  <Changes>
    <Change>
      <Type>CO+RP</Type>
      <TypeVerbose>Replaced</TypeVerbose>
      <Path>/src/game/Player.cs</Path>
    </Change>
    <Change>
      <Type>CO+CP</Type>
      <TypeVerbose>Copied (new)</TypeVerbose>
      <Path>/src/game/Enemy.cs</Path>
    </Change>
  </Changes>
</StatusOutput>
```

#### All platforms  - Desktop GUI : Render Markdown in attribute tooltip

When the **Attributes** panel trims an attribute with an ellipsis, hovering shows a tooltip with the full content.

Previously, Markdown-formatted attributes displayed as raw text in that tooltip. The tooltip now renders Markdown using the same preview as the edit-attribute dialog: headings, lists, links, and images all display formatted. Long values scroll inside the popup, links are clickable, and moving the cursor into the popup keeps it open.


**An attribute with the tooltip showing Markdown content:**
![An attribute with the tooltip showing Markdown content](/api/media?file=/unity-version-control/media/images/release-notes/img/99fba7baa160135e2a3b3f9ea19cf81702dc4fe6c6ad00ee8d57ccea719aa125.png)

### Bug

#### All platforms - Desktop GUI - CLI : Xlink conflict dialog resolves the target changeset ID instead of showing the raw GUID

When merging two branches that both changed a read-only Xlink, the **Xlink conflict** view used to show each side's target as a raw changeset GUID. The **Keep-source** and **Keep-destination** buttons carried the same GUID. This made it hard to know which changeset each side pointed to.

The dialog now resolves the GUID to the changeset ID when the target is reachable. If the target changeset was purged or the target repo can't be reached, the dialog still shows the raw GUID.

#### Cloud Server: Editing a running mergebot duplicated it

Previously, editing a running cloud mergebot from the dashboard registered a duplicate in-memory instance each time it was saved. Every duplicate reacted independently to the same branch-resolved event, so each resolve triggered multiple merge attempts: one real merge and the rest reporting `MergeNotNeeded`.

Now, the start/stop lifecycle is handled in a single place, so editing a running mergebot results in exactly one stop and one restart.

***

## 11.0.16.10330

> **Note:**
>
> **Public** | 2026/08/04

### New

#### All platforms - Desktop GUI : Markdown support in attribute values


**Markdown support in attributes:**
![Markdown support in attributes](/api/media?file=/unity-version-control/media/images/release-notes/img/301585025efc01da855e8ae8c409506dc25ff21ce854aeab008267dddc3578e2.png)

Attribute values now carry Markdown. The **Apply Attribute** dialog picks the layout based on the content:

* **Plain text**: keeps the compact single-line dropdown.

* **Markdown** (existing value, pasted value, or default template): flips into a side-by-side raw editor and live preview that updates as you type.

Admins can seed a Markdown skeleton in the attribute's comment field so anyone applying it lands in the editor with the template preloaded.

Example:

```text
default: # What changed
## Motivation
## How to test
 -
 -
```

Values now go up to **5,000 characters** (was 1,000).

#### All platforms - Desktop GUI : confirm before deleting an attribute from an object

The **X** button on an attribute pill in the object details panel used to delete the value silently. Now the button asks for confirmation before deleting.

The confirmation dialog shows a preview: a one-line snapshot of the value being deleted so you can double-check it's the correct one. It offers two options:

* **Yes**: removes the attribute value from the object.

* **No / close**: makes no changes.

This change applies to every attribute-value deletion in the Desktop GUI. There's nothing to configure.

#### All platforms - Command-Line: `cm attribute set` now accepts a file parameter for the attribute value

`cm attribute set` now has a `--valuecontents=<file>` option that sets an attribute value from a file instead of a command-line argument. Use this for multi-line values or values containing special characters such as URLs with `?` or `&`.

Example:

```text
$> cm attribute set att:Status br:/main --valuecontents=AttributeValue.txt
```

### Bug

#### Cloud Server : Updating an existing trunkbot could break the mergebot

Previously, updating a trunkbot from the dashboard without including the internal field `bot_user` would delete the missing field on the server side.

The mergebot then failed to start. The server log showed "The mergebot cannot be started since its user ApiKey \[] doesn't exist".

Now, if the field is missing from the update request, the server now preserves its from the existing configuration.

#### All platforms - Command-Line: `cm attribute set` can't set values with wildcards

Fixed an issue where attribute values containing `?` or `*` characters were incorrectly treated as file wildcards, causing the command to fail and show the command usage.

Example of a command that previously failed and now works:

```text
$> cm attribute set att:url br:/main "https://myservice.com/api/list?querymode=default"
```

***

## 11.0.16.10303

> **Note:**
>
> **Public** | 2026-07-24

### New

#### Windows - Desktop GUI: Unity Smart Merge available as a merge tool option

When you add a merge tool under **Preferences** > **Merge tools** > **Add**, you can now select Unity Smart Merge (UnityYAMLMerge). Previously, this shortcut only existed on macOS; Windows users had to locate and enter the tool path manually. The path is detected automatically for Unity 6 and earlier.

### Bug

#### All platforms - All clients: Fixed disk move detection for identical files

When multiple tracked files had the same content but different names and were moved only on disk (not with Unity VCS or `cm mv`), pending changes and `cm status` might pair them incorrectly and suggest incorrect renames. Move detection now prefers the candidate with the same file name when hashes match or similarity scores tie, so moves keep the correct names after the operation.

The behavior applies as follows:

* Desktop GUI: Wherever local moves are calculated and **Find moved and renamed files and directories** is enabled in **Pending changes** options.

* Command-Line: In a full `cm status`, where local move detection is active unless you limit change types.

#### All platforms - Desktop GUI: Scrollbar missing when viewing an added file's contents

Previously, the diff viewer didn't show a draggable scrollbar when displaying the contents of an added file: scroll worked with the mouse wheel but not by dragging the scrollbar. This happened in the **Pending changes** view, the **Diff** window, and code reviews. The scrollbar is now shown and works correctly when viewing the contents of an added file.

#### All platforms - Desktop GUI: External tool not updated when selecting a row in the Merge tools table

When selecting a row in the merge tools table under **Preferences** > **Merge tools**, the **External tool** field didn't update to show the tool configured for that row. The field now correctly reflects the external tool of the selected row.

***

## 11.0.16.10275

> **Note:**
>
> **Public** | 2026-07-02

### New

#### All platforms - Desktop GUI: Switch to the reviewed branch from a code review

Added a **Switch workspace to this branch** to the Code Review window's header. Click it to switches the active workspace to the branch under review.

If the review was opened without an active workspace, for instance from a Plastic link, clicking the button first opens an existing workspace for the reviewed repository, or shows a dialog to create one if none exists locally.

### Bug

#### All platforms - Desktop GUI: Fixed misalignment of the "Resolved in cs:X" link in the code review conversation panel

Previously, the changeset link inside the **Resolved in cs:X** badge in the code review conversation panel was misaligned with the surrounding text. The link now aligns correctly with the **Resolved in** label.


**Screenshot:**
![Correctly aligned label](/api/media?file=/unity-version-control/media/images/release-notes/img/9b0873e5fb0b506ecdac22f2397f38976e69663b5d61ca8d9783b34c89a16f37.png)

#### All platforms - Desktop GUI: Fixed misaligned comment in the Attributes view details panel

The comment inside the **Details** panel of the **Attributes** view appeared vertically centered instead of aligned to the top. The comment is now top-aligned again, matching the previous layout.

#### All platforms - Desktop GUI, Gluon: Fixed directories not expanding or collapsing when double-clicked

Double-clicking a collapsed directory didn't expand it, and double-clicking an expanded directory didn't collapse it. This affected tree views in several panels, including the **Workspace Explorer** view, **Pending Changes** view, and **Browse Repository** panels. Directories now expand and collapse correctly when double-clicked.

#### macOS - UVCS tray agent: An edge case could cause two instances to run

In version 11.0.16.10255, we removed the `System Events.app` permission prompt for adding the UVCS Tray agent at user logon. Instead, we use a LaunchAgent plist file deployed in `$HOME/Library/LaunchAgents`.

However, several reboots could result in two UVCS Tray agents running at user logon. We fixed this race condition in this version: the system now checks whether the UVCS Tray app is configured through either **System Settings > General > Login Items & Extensions** or the presence of the `$HOME/Library/LaunchAgents/com.codicesoftware.unityvcstray.plist` file.

***

## 11.0.16.10255

> **Note:**
>
> **Public** | 2026-06-25

### New

#### All platforms - Desktop GUI: Branch Explorer labels stay visible at lower zoom levels

The Branch Explorer now keeps changeset numbers (on hover), changeset comments, and branch captions visible down to 50% zoom. Below that threshold the three labels hide together, since the text is no longer legible at that scale.

Previously, changeset numbers and comments started hiding below 80% zoom even while still readable, and branch captions remained visible at any zoom level.

#### All platforms - Desktop GUI: Clickable changeset and branch links in diff and code review panels

The **Diff changeset by changeset** detail panel now shows the full changeset properties panel in both the **Branch Diff** window and the **Code Review** branch view.

Previously, this panel showed a plain text header. Now, the changeset number is a clickable link with:

* A right-click context menu (options: Copy, Copy link, Copy spec, Open).
* A **Copy GUID** button.
* A responsive details layout.
* The changeset comment.

This matches the changeset properties shown in the **Branch Explorer**.

The **Code review** panel's **Review entire branch** and **Single changeset** views now use the same properties panel, so the branch or changeset name is a clickable link with the same context menu and Copy GUID button.

The **Single changeset** view no longer shows a gray box with a double border.

#### All platforms - Desktop GUI: Reviewer group members can now mark a code review status

The **Mark Review** button in the **Code Review** panel is now enabled for users who belong to a reviewer group assigned to the review, even if they are not explicitly listed as individual reviewers. Previously, the button was only enabled for users directly added to the reviewer list.

When a reviewer group member sets their status, the server adds them to the reviewer list automatically and updates the reviewer group status accordingly.

This behaviour requires an up-to-date server. When connected to an older server, if users are not already in the reviewer list, the desktop GUI shows an error message.

#### All platforms - Desktop GUI: Automatic handling of .meta files during Add operations

When adding assets to source control in Unity projects, ancestor folders' .meta files are now automatically included in the operation. This prevents orphaned private .meta files when adding nested folder structures.

What changed:

* The setting **Rename .meta files automatically** has been renamed to **Handle .meta files automatically** (found in **Preferences** > **Other options**).

* When enabled, the Add operation now includes .meta files for all ancestor folders being added to source control.

* The setting continues to control automatic .meta file handling for rename operations.

**Note**: This setting is enabled by default. Disabling it reverts to the previous behavior where only the asset and its ancestor folders are added, without their corresponding .meta files.

#### macOS - UVCS tray agent: Removed `System Events.app` permission prompt

Previously, the UVCS installation on macOS Tahoe ended with a prompt asking the user to enable this permission to start the UVCS tray agent on user login:

```text
 "PlasticSCM.app" wants to control "System Events.app"
```

The use is no longer prompted for permission. The UVCS tray agent is enabled on user login through a LaunchAgent plist file deployed in `$HOME/Library/LaunchAgents`.

### Bug

#### All platforms - Desktop GUI: Fixed External tool not found error when selecting a default tool

In **Preferences** > **Diff/Merge tools**, selecting the Default tool no longer fails to save with an External tool not found error.

The path-validation check now correctly recognizes the built-in Plastic GUI diff/merge tool as a valid choice.

#### All platforms - Server: Fixed client-side triggers not running for User-role members

In Unified Organizations, client-side triggers (such as before-clientcheckin) were silently skipped when the operating user's role was User instead of Owner or Manager.

The trigger list returned to the client is no longer filtered by view permission, so configured client-side triggers now run for every authenticated user in the organization. Trigger administration and single-trigger lookups continue to require the relevant permissions.

***

## 11.0.16.10216

> **Note:**
>
> **Public** | 2026-06-10

### New

#### All platforms - Desktop GUI: Context menu on object links

Right-click a changeset, branch, or label link in the Properties panel header to show a context menu with four new options:

* **Copy**: Copies the full text shown in the link to the clipboard.

* **Copy link**: Copies a shareable "Plastic Link".

* **Copy spec**: Copies the full spec of the selected object.

* **Open**: Navigates to the selected object.

The menu is available wherever these links appear, including the **Branch Explorer**, **Branches** and **Changesets** views, diffs of objects and history revisions.


**New context menu options:**
![New context menu options](/api/media?file=/unity-version-control/media/images/release-notes/img/982d406c1936e5101bb63718c46d33125aa63b69e54c83328e9bdf1be4a73fce.png)

#### All platforms - Desktop GUI: Embedded diff viewer in Branches and Changesets views

The **Branches** view and **Changesets** view can now show file diffs inline in their **Details** panel, matching the experience already available in the **Branch Explorer**. Select **Differences** in the **Details** panel to reveal the embedded viewer below the diff tree. Select a file in the tree to refresh its content.


**Embedded diffs:**
![Embedded diffs](/api/media?file=/unity-version-control/media/images/release-notes/img/b6c55547da4f0e90c948e4cf3be24b372695ba86bf0ea167898ffe3a9cf86fa2.png)

#### All platforms: Upgrade Plastic Desktop and Gluon to Avalonia 11.3

Upgraded our GUI applications so now they use Avalonia 11.3, which provides UI improvements and fixes.

### Bug

#### macOS - Gluon: Cmd+X (cut) now works in the Workspace Explorer

Previously, pressing **Cmd+X** in the **Workspace Explorer** view on macOS did nothing. The shortcut now performs the cut action correctly.

***

## 11.0.16.10181

> **Note:**
>
> **Public** | 2026-05-21

### New

#### All platforms - Desktop GUI: Difference list and diff viewer in Branch Explorer and Query view details

In the **Branch Explorer** and **Query** view, the **Details** panel now has a **Differences** list. The list is visible when selecting a branch, changeset, or label. For branches, you can view either the entire branch diff or the changeset-by-changeset diff.


**Screenshot:**
![The Details panel showing a diff for the entire branch](/api/media?file=/unity-version-control/media/images/release-notes/img/94cf1544387f958455397439570cff824711ab344a0116ff6ace7eda11dbbd00.png)

The **Branch Explorer** also has an embedded diff viewer.
To open the viewer, double-click a file in the **Details** **Differences** list, or pick **Diff** from the file's context menu.

The **Differences** list context menu also has a new **Diff in a separate window** option, which opens the standalone diff window.


**Screenshot:**
![The diff viewer showing a change](/api/media?file=/unity-version-control/media/images/release-notes/img/1e2175110b067d47bbd05eef4b12e6059900cf49f35e299e60dd2b4f716cd1f3.png)

#### All platforms - Desktop GUI: Show repository tree for selected labels

Updated the **Labels** view details panel and the **Branch Explorer** details panel to show the repository tree at the labeled changeset when you select label. This provides a meaningful snapshot of the tree at that point in history.

Previously, both views showed the diff of the labeled changeset, which is not useful for a single label. You can still see the change this way by selecting a changeset or branch in the **Branch Explorer**.

Right-click menu actions on items in the tree work the same as in the standalone **Browse repository** view. The label name in the **Properties** header is no longer clickable in the **Labels** view details panel.

#### All platforms - Desktop GUI: Changeset color configuration and changeset number in Branch Explorer

Changeset color configuration options for the **Branch Explorer** are now in the dedicated **Settings** window as a new tab. You can color changesets by user or replication source, or both at once.

User avatars can also be displayed independently from the changeset colors. When avatars and colors are both active, the colors are displayed in the ring around the avatar.


**Screenshot:**
![Changeset color definitions](/api/media?file=/unity-version-control/media/images/release-notes/img/a1b5ccfc975482603393bf26004105d1db242c8b984d2184c45d2f25c343bf9b.png)

Also in the **Branch Explorer**, a changeset number label appears above the node when you hover over a changeset in.


**Screenshot:**
![Changeset number above a node](/api/media?file=/unity-version-control/media/images/release-notes/img/dff66f12a8a2f82e97a139ac56b8487f0eda17762ebf5e2773a2bd23076d3cda.png)

This feature is enabled by default. You can disable it from the **Branch Explorer** display options.

#### All platforms - Desktop GUI: Properties panel shows repository and replication source

Updated the **Properties** panel in the **Details** view to display the repository name and the replication source.


**Screenshot:**
![Changeset replication src field](/api/media?file=/unity-version-control/media/images/release-notes/img/89ba73e3efa6f8a9ab48397cf8125d64e19aa1beb08aa11d58191e730227383d.png)

#### All platforms - Desktop GUI: Added vertical separator between attribute badge action buttons

Added a vertical separator between the **Edit** and **Delete** buttons on each attribute badge, drawn in the same color as the badge border, along with extra spacing for a cleaner look and better usability.

#### All platforms - Desktop GUI: Design changes in the Branch Explorer

Moved the **Settings** button in the **Branch Explorer** to the bottom-left corner of the panel, next to the **Zoom Out** button, to prevent accidental clicks.


**Screenshot:**
![The Settings button is next to the Zoom Out button](/api/media?file=/unity-version-control/media/images/release-notes/img/b136cd4e19f2dff3f7cda881572af8eb19d1b7948ff1ee7ef556f49f65b91971.png)

Updated the home icon in the **Branch Explorer** changeset shape to fill the shape when contributor avatars are disabled, and to display as a small overlay in the corner when avatars are enabled. In either case, the checked-out changeset continues to use the larger home glyph.


**Screenshot:**
![The home icon with a full shape](/api/media?file=/unity-version-control/media/images/release-notes/img/4329b777ad25ec792b87634c8e2f5958425bd3ff2453cfe3bafcdee139f2545d.png)

#### All platforms - Desktop GUI: Toggle hidden-branch changesets in Changesets view

Added a toggle to the **Changesets** view to show or hide changesets from hidden branches. You can now inspect those changesets without first unhiding branches. By default, this option is disabled.

#### All platforms - Desktop GUI: Clickable changeset links in the merge Xdiff header

The Xdiff window opened from **Diff source with destination** during merge conflict resolution now displays clickable changeset links.

Click a link to open the changeset diff window with all the changes in that changeset. This is the same view as the existing changeset link in the **History** view.

#### All platforms - Desktop GUI: Details panel remembers open/closed state and width

Updated the **Branch Explorer**, **Branches**, **Changesets**, **Labels**, and **Attributes** views to persist the details panel visibility and width across sessions.

The **Details** panel width in the **Branch Explorer** is also preserved between sessions.

#### All platforms - Command-line client: New subcommand to set the repository hashing algorithm

To set the hashing algorithm used by a repository, use the `admin hashalgorithm` subcommand in the `cm` command-line client.

Only the server administrator can execute this command; non-admin callers are rejected with the standard admin-only error.

```text
cm admin hashalgorithm <repspec> (md5 | sha1)
```

Previously, the per-repository hashing algorithm could only be configured through an in-process server shell command that required raw organization and repository IDs. Operators can now set it through the regular `cm` CLI using a human-readable repository spec.

The new algorithm applies to data hashed by the server from this point on. Changing the algorithm on a repository that already contains data is supported, but operators should consider the implications before doing so.

#### All platforms - Command-line client: Hash algorithm available as format token

Added a `{hashalgorithm}` output format token to `cm find`, `cm history`, and `cm ls`. This output returns the algorithm name (MD5, SHA1) used to produce the revision's `{hash}` value.

The WebAdmin Find JSON endpoint exposes the same field as `hashalgorithm` when explicitly requested.

The default output formats are unchanged; the token is opt-in with the `--format` option (or the fields list, for the JSON endpoint). Revisions without a hash render an empty value.

```text
cm find "revisions where date >= '1 weeks ago'" --format="{hash}|{hashalgorithm}|{owner}|{path}"
```

#### All platforms - Command-line client: cm patch supports --clean and --integration options

Added `--clean` and `--integration` options to `cm patch`. These were previously only available in `cm diff`.

Use the options to:

* `--clean`: Generate patches that exclude merge content.
* `--integration`: Generate patches that show only the changes pending integration into the parent branch.

These options make it easy to get a focused diff of a task branch for code review or AI-assisted workflows.

#### All platforms - Server: Unlimited lifespan for Personal Access Tokens

Added support for unlimited (never-expiring) lifespans for Personal Access Tokens (PATs). The previous limit was 180-day maximum for CI/CD and automation use cases that require long-lived credentials.

Server-side, the maximum PAT lifespan is controlled by the `AccessTokenLifespan` setting in `server.conf`, inside the `AccessTokensSettings` block. If not explicitly configured, the default maximum lifespan is 180 days.

##### Enable unlimited PAT lifespans

To enable unlimited PAT lifespans, set `AccessTokenLifespan` to `infinite`:

```text
<AccessTokensSettings>
  <Enabled>true</Enabled>
  <AccessTokenLifespan>infinite</AccessTokenLifespan>
</AccessTokensSettings>
```

Client-side, the lifetime argument now accepts the `infinite` keyword:

```text
cm accesstoken create "My automation token" infinite
```

##### Create unlimited PATs with the REST API

When creating PATs using the REST APIs, the lifetime field in `POST /api/v1/personal-access-tokens` is now optional. When omitted, the server's default lifespan applies.

To request a token with no expiration, omit the lifetime field and ensure the server is configured with an unlimited lifespan:

```text
POST /api/v1/personal-access-tokens
{
  "description": "My automation token"
}
```

#### Windows, macOS — New unified desktop agent

Unified PlasticFS and Cloud Drive into a single desktop agent: `unityvcstray`.

This update simplifies startup and background service management.

Backward compatibility is preserved through legacy entry points/wrappers (`plasticfs` and `unityclouddrive`) that now route to the unified app.

Additional notes:

* Currently, PlasticFS is available only on Windows.

* Cloud Drive remains in beta. If you have never used it before, enable it by creating an `enableclouddrivetray.token` file in your `plastic4` config folder.

### Bug

#### All platforms - All clients: Fix exception when diffing a replicated branch whose parent changeset was not replicated

When a branch was replicated without its parent changeset, viewing its differences in the Desktop GUI or fetching its history from `cm` caused a crash with an unhandled error.

Now the diff view returns an empty result, and the branch history returns a clear error message indicating that the parent changeset couldn't be found.

#### All platforms - All clients: EOL and compression filter rules now support paths with spaces

Previously, EOL and compression filter rules that contained paths with spaces were not applied correctly. This is now fixed.

Compression sample:

```text
none /db/backup/blob.dat
```

EOL sample:

```text
auto /src/client/my script.ps
```

#### All platforms - Desktop GUI: Apply Branch Explorer options immediately

Fixed **Branch Explorer** settings to take effect without requiring a restart.

#### All platforms - Desktop GUI: Fixed outdated branch diff from the Branches view

Now using the current branch head from the server instead of branch information from when the tree was last loaded. This fix applies to **Diff branch**, **Diff with another branch**, and the embedded diff in the **Branches** view details panel.

New changesets from another workspace or client now appear without refreshing the list. The same fix applies when creating a top-level branch from the **Branches** view while new changes exist on the selected branch.

#### All platforms - Desktop GUI: Don't show attributes for checkout changeset

The **Branch Explorer** details panel was showing the **Attributes** section and the **Add attribute** button when selecting the checkout changeset. Because this is a virtual changeset that doesn't exist on the server, the attributes panel is no longer displayed for it.

#### All platforms - Desktop GUI: Bring changes on Switch option moves Added files to Default changelist

Files with **Added** status assigned to a user-defined changelist now remain in the correct changelist when switching branches with the Bring Changes on Switch option.

#### All platforms - Gluon: History panel doesn't update selected items

Fixed the **History** panel to select only the relevant revisions after operations that previously resulted in additional unwanted selections.

***

## 11.0.16.10042

> **Note:**
>
> **Public** | 2026-03-19

### New

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Rebrand to Unity Version Control

Unity DevOps Version Control product has been rebranded to Unity Version Control.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Enhanced properties panel

* Redesigned the properties panel that is displayed at the side of the Branch Explorer and other query views (Changesets, Branches, Labels and Attributes).
* The selected object information is shown in a more compact way, including an icon or avatar with the object's owner.
* The comments panel saves the edited comment when you switch from one object to another.
* The Attributes panel shows each attribute in a small colored badge.


**Redesigned properties and attributes panels:**
![Redesigned properties and attributes panels](/api/media?file=/unity-version-control/media/images/release-notes/img/56d81f1c3bf6b89dee1295baa80d4b5a97ef9869eec0439c5499bf38e34897ed.png)

* Removed the Branch Explorer settings from this side panel, to leave space for the selected object differences, which will be included in a following release.
* Moved the settings for display options and conditional formatting to a dedicated dialog window. To open it, select the Settings button in the Branch Explorer view.


**New Branch Explorer settings window:**
![New Branch Explorer settings window](/api/media?file=/unity-version-control/media/images/release-notes/img/85554e4888029a48917de557e4ddef9916a523c56469ef4646e6a3f78316c783.png)

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Enhanced branch explorer search box UI

The branch explorer search box's **Next** and **Previous** button are now inside the text areas.

Added a search match counter (current vs. total).


**Branch Explorer search box control:**
![Branch Explorer search box control](/api/media?file=/unity-version-control/media/images/release-notes/img/ecd5fc843f2db78d63040db89fad9cb4c80ccac88500d133f933acf14ee95582.png)

#### All platforms - Desktop GUI

All platforms - Desktop GUI: JetBrains plugin removed from client installers

The JetBrains plugin bundle is no longer included in the client installation package. Install the plugin directly from the JetBrains Marketplace.

### Bug

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Fixed changelist assignments lost after switch with **Bring changes**

Files assigned to custom changelists (for example, "Ignore this") are no longer moved to the Default changelist after switching revisions with **Bring changes** enabled. Changelist assignments are now correctly preserved across switch operations.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Smaller font for labels in the Branch Explorer

Reduced the Branch Explorer label caption font size so label names show more characters before ellipsis, improving readability.

***

## 11.0.16.9998

> **Note:**
>
> **Public** | 2026-03-05

### New

#### All platforms - Desktop

All platforms - Desktop: Show user avatars in the Branch Explorer

The Branch Explorer view now displays the changesets using the owner's avatar instead of a solid color circle. This allows to easily see who committed each changeset without the need of configuring user colors.

This feature can be enabled by toggling the "Display user avatar in changesets" in the Branch Explorer's display options


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/45388c48d9519573434f01538c1ef3cd8bd76a441475452ee6b64aa1ad286724.png)

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Changeset comment captions in the Branch Explorer

Changeset comments are now displayed in the Branch Explorer below each changeset as a small caption, expanding on hover to show the full comment.

Tooltips in the Branch Explorer have been removed, as this information is now shown directly in the canvas.

You can enable the changeset comment captions in the "Display options". Make sure to have enough zoom applied to the Branch Explorer to see them, as they are only visible until a certain level.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/0c6c4a86a4bbdd31d145802fbf7361475acd322526457c396d5b342c8943a971.png)

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Hover style and animations in the Branch Explorer

Added new visual effects to the Branch Explorer when moving the mouse over the changesets, branches and labels


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/8a2b0bcfb1e40c12f2d9f090b76912d3eab8b9313f40050c8ee6eca888b54870.png)

### Bug

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Page Up works correctly in lists

In all the views displaying a list or tree (Items, Pending Changes, Branches, etc ...) pressing Page Up now moves the selection to the top item within the currently visible list area, instead of jumping to the very first item (as if Home was pressed).

***

## 11.0.16.9973

> **Note:**
>
> **Public** | 2026-02-26

### New

#### All platforms – Plugin for JetBrains IDEs

All platforms – Plugin for JetBrains IDEs: Show recommended cm version and download link in Configuration view

The **Configuration** view now displays the recommended cm version for the current plugin build, with a clickable **Download** link that downloads the matching cm client bundle directly from the IDE. The download runs in the background with a progress indicator and saves the file to the user's Downloads folder.

#### All platforms

All platforms: The server can now dictate the repository hashing algorithm to the client.

UVCS currently supports two file hashing algorithms: SHA1 and MD5. The hashing algorithm in use depends on the `FIPSCompliant` flag defined both in `client.conf` and `server.conf`.

However, both client and server had to have the flag configured to the same value for hashing to work. Misconfigurations could result in repositories storing hashes in one format whilst the clients expected the hashes in a different format, and the other way around.

Now, the hashing algorithm can only be configured from the repository server. If both server and client are using this UVCS version or newer, the client honors the configuration set on the server regardless of the `client.conf` `FIPSCompliant` setting.

For newer clients working against older servers, or the other way around, the client's `FIPSCompliant` flag is still in use, to ensure backwards compatibility.

***

## 11.0.16.9943

> **Note:**
>
> **Public** | 2026-02-12

### New

#### All platforms - Gluon

All platforms - Gluon: Skip update report message after applying a shelved added file

Before, updating the workspace after applying a shelve that contained an added file showed the following report message:

***

The item won't be unloaded because it is already changed (checked-out, locally changed, deleted, moved or reverted) in the workspace: 'file.txt'. Please undo or checkin the local change and retry the operation.

***

This scenario is now improved and no message is reported since there is no collision with server changes.

***

## 11.0.16.9925

> **Note:**
>
> **Public** | 2026-02-05

### Bug

#### All clients

All clients: Fixed comment truncation from GitSync or fast-import

When truncating long comments during GitSync or fast-import operations, if the truncation point fell exactly at a high surrogate character (part of a Unicode surrogate pair used for emojis and other special characters), the surrogate pair would be split. This caused later serialization to fail with an "Unable to translate Unicode character" error.

We now check if the character at the truncation point is a high surrogate and reduce the length by one character to avoid splitting the pair.

#### All platforms – Plugin for JetBrains IDEs

All platforms – Plugin for JetBrains IDEs: Compare with same repository version not working for Replaced files

The "Compare with Same Repository Version" context menu option now correctly displays differences for Replaced files. Previously, this operation would show a "Cannot get revision content" error when comparing Replaced files created during branch merges.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: An item with the same key added error in tree view

Fixed an issue in the Pending Changes tree view where multiple changes to the same file could trigger an "An item with the same key has already been added" error.

Now, multiple changes are displayed correctly.

***

## 11.0.16.9915

> **Note:**
>
> **Public** | 2026-01-29

### New

#### All platforms – Command line client

All platforms – Command line client: Revision ID available in status command output

The `cm status` command now supports an optional `--includeRevId` flag that, when used with `--machinereadable`, includes the revision ID for each change in the output. The revision ID is added as an additional field after the directory flag and before the merges information.

This enables plugins and integrations to obtain revision information directly from the status command without additional operations.

### Bug

#### All platforms – Plugin for JetBrains IDEs

All platforms – Plugin for JetBrains IDEs: Diff not loaded for replaced files

The diff view now correctly loads and displays differences for files with "Replaced" status. The plugin now retrieves parent revision IDs directly from the status command output, which eliminates the need for additional commands and ensures reliable diff loading for all file change types, including replaced files.

#### macOS – Plugin for JetBrains IDEs

macOS – Plugin for JetBrains IDEs: Fixed server list failing to load on macOS

Fixed an issue on macOS in which the attempt to clone a Unity Version Control repository from Rider's welcome window would result in the server list never populating. An error in the logs would indicate that the `cm` command could not be found. Now, the **Clone Repository** dialog correctly initializes Unity Version Control and loads the server list on first access, regardless of whether a project is open.

***

## 11.0.16.9890

> **Note:**
>
> **Public** | 2026-01-22

### New

#### All platforms - Desktop GUI and Gluon

All platforms - Desktop GUI and Gluon: Automatic .meta file renaming

Added support for automatically renaming .meta files when renaming files or directories in the workspace.

Enable this feature in Preferences > Other Options > Miscellaneous > Rename .meta files automatically. When enabled, the GUI will automatically rename associated .meta files alongside the main file or directory, and prevent conflicts if the destination .meta file already exists.

This is a GUI-only setting and is enabled by default.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/1989f5cffcda6c4bd69a878a93c66275aa525590ec2c7a8a8d6d9706b84df49b.png)

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Added filter to the diff changeset by changeset panel

When viewing the diff of a branch in changeset by changeset mode, you were only able to see the list of changesets. For big branches with a lot of changesets, it could be difficult to find a specific one by its comment, so we added a filter to be able to search in this list


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/35b1e6dc43e90a0b26d45b0412b8d3f398dc45be0daab5d968ce982ceaf33a81.png)

#### All platforms – Plugin for JetBrains IDEs

All platforms – Plugin for JetBrains IDEs: Organization/Server selection added to Clone Repository workflow

Users can now select from all available Unity Version Control (UVCS) organizations or servers when cloning a repository, not just the default workspace server. The server list is populated based on the current user's configured profiles, and the repository list updates automatically when a different org/server is selected. If no additional profiles are configured, only the default org/server will be available. This enhancement improves flexibility and usability for users working with multiple orgs/servers.

***

## 11.0.16.9872

> **Note:**
>
> **Public** | 2026-01-15

### New

#### All platforms - Plugin for JetBrains IDEs

All platforms - Plugin for JetBrains IDEs: Configuration panel available in IDE settings

The UVCS configuration panel is now available again in the IDE settings view. The panel has been adjusted to align with other VCS plugin panels, and the cm path field now auto-detects the default UVCS installation path when left empty, matching the behavior of Git and Mercurial plugins.

### Bug

#### All Platforms - All Clients

All Platforms - All Clients: Resolved a compatibility error when deleting an empty branch

Previously, compatibility was not maintained when attempting to delete an empty branch using a newer client (e.g., 11.0.16.9213) with an older server version (e.g., 11.0.16.7504).

The operation failed with an incorrect message indicating that the server needed an upgrade, despite the server being fully capable of deleting empty branches.

#### All platforms - Gluon

All platforms - Gluon: Fixed endless search dialog progress when no results are found

The "Searching..." message and spinner now disappear when a search completes with no matches. Previously, they remain visible indefinitely.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/ed0a29547d9d351c774ce557d28648d70877c9dc3f59411bf92662feaf88721a.png)

#### All platforms - Plugin for JetBrains IDEs

All platforms - Plugin for JetBrains IDEs: File history revisions now displayed in correct order

The file history view previously listed revisions in reverse order, with the oldest entry at the top. This caused confusion when comparing changes between revisions. Now, revisions are displayed from newest to oldest, making it easier to understand file evolution and compare changes as expected.

#### All platforms – Plugin for JetBrains IDEs

All platforms – Plugin for JetBrains IDEs: Improved error handling in VCS operations

Error handling in VCS operations has been updated to use Messages view notifications instead of blocking dialog popups. This change prevents multiple error dialogs from appearing in batch operations, resolves thread safety issues, and improves user experience by avoiding intrusive popups.

***

## 11.0.16.9843

> **Note:**
>
> **Public** | 2025-12-17

### New

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Deleting a branch shows branch name

The dialog to confirm the deletion of a branch wasn't showing the name of the branch to be deleted. We now show this information in the explanation to make the operation safer.

We also added this branch information to the text shown in other deletion dialogs across the application.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/e33009a5c767d4889476059aa1645beaed868eb06cb10778650ef6a327d8a5fd.png)

### Bug

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Fixed broken documentation link

Corrected an outdated reference to the smart locks documentation in the help pages.

#### Command-line

Command-line: Fixed 'No such user' error for code review creations and updates

Corrected an issue in the the `cm codereview` command: the assignee validation was incorrectly performed against the default server configured in the `client.conf`, instead of the server associated with the code review. This caused an error if the user didn't exist in the default server. The system now resolves the assignee's SEID against the server associated with the code review. This prevents "No such users" errors when creating a new review or changing an existing review's assignee.

#### All Platforms - Server

All Platforms - Server: An overflow error prevented SEID checking under some Active Directory configurations.

In release 11.0.16.9785, we added a safeguard to prevent the server from hanging when Active Directory authentication stalled (due to a locked account during the AcceptSecurityContext phase).

However, certain Domain Controller `lockoutDuration` settings could overflow during this check. This blocked authentication when the AD controller requires an administrator to manually unlock the account.

This issue has now been fixed.

***

## 11.0.16.9832

> **Note:**
>
> **Public** | 2025-12-04

### New

#### All platforms – Plugin for JetBrains IDEs

All platforms – Plugin for JetBrains IDEs: Unity Version Control Plugin Rebranding

The plugin has been rebranded from Plastic SCM to Unity Version Control, reflecting the evolution of the version control system. This update brings a fresh identity and improved consistency across all Unity tools.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/8a0ceab65719dc3310539cb0fe9f285c0a7afd08e110019b1796d6fa0d8455bf.png)

What's Changed:

* Plugin Name: The plugin is now called "Unity Version Control" (previously "Plastic SCM Integration"), aligning with JetBrains Marketplace guidelines and providing a clearer, more concise name.

* Visual Identity: Updated plugin logo and icons to match the current Unity Version Control branding, providing a consistent visual experience.

* User Interface: All menu entries, context menus, dialog titles, and user-facing messages now display "Unity Version Control" instead of "Plastic SCM" throughout the plugin interface.

* Bundle Name: The plugin bundle has been renamed from plastic4intellij-X.Y.Z.zip to `unity-version-control-X.Y.Z.zip`. The plugin remains in the same location, but if you have any scripts or automated processes that reference the old bundle name, you'll need to update them accordingly.

* Automatic Project Migration: Existing projects configured with Plastic SCM are automatically migrated to Unity Version Control during plugin startup.

* Plugin Version: Upgraded to version 2.1.0 to reflect the significance of this rebranding update.

All functionality remains the same—this is purely a rebranding update. Your workflows, settings, and project configurations will continue to work exactly as before.

### Bug

#### All platforms – Plugin for JetBrains IDEs

All platforms – Plugin for JetBrains IDEs: Random PluginException during plugin startup

Fixed a random PluginException that occurred during plugin startup when IntelliJ's VcsOperationLog tried to deserialize VcsOperation instances. The error was caused by default constructors passing null project arguments, which violated @NotNull constraints.

#### All platforms – Plugin for JetBrains IDEs

All platforms – Plugin for JetBrains IDEs: Clone repository dialog shows "!NullReference:text\_key" when opened from Rider Welcome view

The plugin now ensures localization is properly initialized when requesting the UVCS clone component, allowing the clone repository dialog to load all texts correctly when accessed from the Rider Welcome view.

#### All platforms – Plugin for JetBrains IDEs

All platforms – Plugin for JetBrains IDEs: Rollback operation fails to undo folder movements

The rollback operation now correctly undoes both folder movements and file modifications. Previously, when rolling back changes after moving a controlled folder and modifying a child file, only the file changes were reverted while the folder movement remained.

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Incorrect file status icons in Workspace Explorer

Fixed an issue where file status icons in Workspace Explorer displayed incorrectly when using a dynamic workspace. The icons could appear mismatched after switching views or refreshing. The update ensures the correct status is shown consistently by refreshing the relevant cells when file or status information changes.

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Fixed freeze when diffing branches in encrypted repositories

Resolved an issue that caused the GUI to hang when diffing a branch without a configured encryption key. The operation now proceeds normally after the user enters the key in the prompt.

***

## 11.0.16.9818

> **Note:**
>
> **Public** | 2025-11-27

### New

#### Windows - plasticfs

Windows - plasticfs: Faster pending changes calculation

We have significantly sped up the pending change calculations, drastically improving the speed of both cm status and the Pending Changes view in dynamic workspaces.

On a medium-large dynamic workspace (over 10,000 directories and 60,000 files), cm status is now up to 68% faster than in the previous version!

### Bug

#### All platforms – Plugin for JetBrains IDEs

All platforms – Plugin for JetBrains IDEs: Fixed IDE freezes during internal operations

Fixed random IDE freezes that could occur during internal operations. The issue was caused by the plugin executing unnecessary version control operations on files that shouldn't be processed.

The fix improves plugin performance by automatically excluding the temporal files from version control processing.

#### All platforms – Plugin for JetBrains IDEs

All platforms – Plugin for JetBrains IDEs: Diff data not loading properly with SSL connections in on-premise environments

The plugin now correctly loads diff data when the server connection is configured via SSL under an on-premise environment. Previously, when modifying files from Rider, the previous revision data (left side) was not loaded in the diff view. This occurred because for SSL connections, the revspec format includes the "ssl://" prefix and port with the ":" character.

#### All platforms – Plugin for JetBrains IDEs

All platforms – Plugin for JetBrains IDEs: Files moved externally and then edited incorrectly shown as private

Files moved or renamed outside the IDE (e.g., using file explorer) and then edited within the IDE are now correctly displayed as changed (blue) in the Changes list instead of incorrectly showing as private (red). The plugin now properly detects external file moves/renames and executes the move command to maintain the file's controlled status. Additionally, rollback operations have been optimized to refresh only affected file revisions instead of the entire project structure, providing significant performance improvements for large projects.

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Fixed broken documentation links

We've updated the Desktop GUI to resolve a couple of broken "Learn more" links and ensure all help references point to the current Unity Version Control documentation. This includes correcting outdated references related to smart locks and dynamic workspaces so that users are taken to accurate, maintained guidance.

***

## 11.0.16.9791

> **Note:**
>
> **Public** | 2025-11-20

### Bug

#### All platforms - Server

All platforms - Server: Improve user credentials check when in Active Directory over LDAP to prevent thread lockouts

The server now detects locked Active Directory accounts before attempting to authenticate. It reads the domain's lockout policy settings and checks the account state prior to performing a Bind. If the account is already locked, the server skips the authentication attempt and returns a clear error message instead.

This change prevents unnecessary Bind calls against locked accounts, which in some cases could stall the server call for as long as the account remained locked.

#### All platforms – Plugin for JetBrains IDEs

All platforms – Plugin for JetBrains IDEs: Cannot show diff: Invalid file path

Fixed an issue where the plugin failed to show differences for changed files in Rider 2025.3.1, displaying an "Invalid file path" error instead.

***

## 11.0.16.9772

> **Note:**
>
> **Public** | 2025-11-13

### Bug

#### All platforms – Command-line client

All platforms – Command-line client: Improved error handling when listing files from unavailable servers

Avoid "Object reference not set to an instance of an object" running cm ls on a workspace from an unavailable server.

#### All platforms - Desktop GUI and Gluon

All platforms - Desktop GUI and Gluon: Error opening Shelves view on older Plastic servers

Fixed an issue where opening the Shelves view could trigger the following error message: "Index was out of range. Must be non-negative and less than the size of the collection. (Parameter 'index')."

This occurred when using older versions of the Plastic server when the shelves view contained shelvesets sharing the same parent changeset.

The client now properly handles this scenario to prevent the error.

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Seamless recovery when workspace folder is restored

Improved how workspaces are handled when their ".plastic" folder is renamed/deleted and later restored. Now, the client toolbar automatically recovers from the "unknown" state if the workspace folder is restored, delivering a more consistent experience across the GUI clients.

#### Linux - Desktop GUI

Linux - Desktop GUI: Fixed exception on upgrade dialog

When using the upgrade dialog to check for a new version, clicking the "Download" button was throwing an exception. On Linux, the expected behavior of this button is opening a browser with the download link of the newest version. We fixed the error and now the dialog behaves as intended

#### macOS - Desktop GUI

macOS - Desktop GUI: Cannot calculate semantic diffs for C language files.

The Desktop GUI applications where showing an error in macOS when trying to calculate semantic differences for C language files.

This problem only affected to macOS ARM systems. Now it's fixed.

#### All platforms - Plugin for JetBrains IDEs

All platforms - Plugin for JetBrains IDEs: Rollback deleted files without IDE hang

Rolling back deleted files from the project could hang the IDE because the previous flow performed a Checkout before UndoCheckout. When the file was missing from disk the Checkout failed and blocked the operation. The plugin now avoids any prior check-out and restores the file data without attempting to check out a missing file first.

***

## 11.0.16.9755

> **Note:**
>
> **Public** | 2025-11-06

### New

#### All platforms - Plugin for JetBrains IDEs

All platforms - Plugin for JetBrains IDEs: Context menu terminology update

To align with UVCS operation terminology and reduce confusion with Rider context menus, several VCS action labels have been updated.

Renamed Actions

* Edit → Checkout

* Add → Add to source control


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/8f44421cf7aab9a46f12242bd2cb9a80036dac4da59f1d0a0df23a46e20a7697.png)

### Bug

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Fixed label in the Create Workspace dialog

When creating a new workspace from the Desktop GUI, there's a field to enter the new workspace name. This field had an incorrect label saying "Drive name". We replaced it with the correct value: "Workspace name"

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Refresh code review updates differences

Fixed an issue where changes pushed after creating a code review did not appear in the "Review entire branch" view after refreshing the code review. The view now reflects all updates made after review creation.

#### All platforms – Plugin for JetBrains IDEs

All platforms – Plugin for JetBrains IDEs: Moved/Renamed files disappear from Project view after a rollback

The Project view now correctly shows files after rollback operations on moved/renamed files, improving the user experience by eliminating the need for manual refresh.

#### All platforms – Plugin for JetBrains IDEs

All platforms – Plugin for JetBrains IDEs: Compare and Annotate operations not working for xlinked files from History view

Fixed an issue where the Compare and Annotate operations triggered from the History view did not work properly for files located inside an Xlink.

***

## 11.0.16.9733

> **Note:**
>
> **Public** | 2025-10-30

### New

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Enabled Undo when having private files selected

In the Pending Changes view you are able to Undo selected changes with the Undo button or with the "Undo changes" option of the context menu. When having private files selected, the context menu option was disabled, because private files cannot be undone - only deleted.

We changed this behavior and now the menu option is always enabled, as long as there is at least one controlled file selected, and it will only apply to the controlled files in the selection.

This behavior is now consistent with the Undo button.

### Bug

#### All platforms –  Plugin for JetBrains IDEs

All platforms –  Plugin for JetBrains IDEs: Incorrect or missing diff data for xlinked files

Fixed an issue where the diff view was displaying incorrect or missing diff data for xlinked files.

In some cases, the plugin showed differences against an unrelated file or highlighted all lines in the editor as modified.

The diff view now correctly compares the modified xlinked file against its proper base version for both legacy and unified organizations.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Fixed exception when showing annotate of an xlink

When seeing the differences of a branch or a changeset, the diff view's context menu has an option to show the annotate of an item. If the selected item is an xlink, an exception was thrown.

It's not possible to show the annotate of an xlink from this view, so we disabled the menu option in this scenario.

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Search results not brought into view in Branch Explorer

When searching for a changeset or branch in Branch Explorer, especially over large date ranges, it did not automatically center or bring the found item into view. Now it's fixed.

***

## 11.0.16.9713

> **Note:**
>
> **Public** | 2025-10-23

### New

#### All Platforms – All Clients

All Platforms – All Clients: Improved profiles.conf behavior

We've enhanced the client so that any changes made to your profiles.conf file are now detected instantly—no need to restart the application.

This means you can add new profiles from multiple clients simultaneously (cli, desktop apps), without worrying about overwriting each other's work.

To further simplify profile management, we now enforce a one-profile-per-server rule. Previously, it was possible to store multiple profiles for a single server, even though only one would be used, which could lead to confusion. With this update, the server name is used as the unique profile identifier, eliminating random suffixes and ensuring the correct profile is always active.

Please note: At this time, only one account per organization or server is supported.

### Bug

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Fixed spacing in release notes

Release notes displayed in the New Version dialog now include proper line breaks between entries. This improves readability and ensures each note is clearly separated.

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Diff viewer scroll sync issue

Fixed an issue in the diff viewer where scrolling would remain at the bottom after navigating to the first line using keyboard shortcuts (e.g., Ctrl+Home). Scrolling and diff alignment now work correctly when moving the caret, ensuring both Text Editors stay in sync.

#### All platforms - Plugin for JetBrains IDEs

All platforms - Plugin for JetBrains IDEs: Avoid errors for temporary IDE sandbox files

Temporary sandbox files (for example, idea-sandbox) were sometimes detected as new and the plugin attempted to add them, causing failed adds for files that live outside VCS-controlled folders. The plugin now skips automatic adds when a file is not purely private. Move/check work runs on a background thread without showing a progress UI, and UI refreshes run on the EDT; normal VCS behavior for files under control is unchanged.

Users should no longer see spurious "The item \[path] does not exist in the workspace" errors for temporary sandbox files, nor the distracting progress indicator or related VCS messages during build/debug cycles.

#### All platforms - Plugin for JetBrains IDEs

All platforms - Plugin for JetBrains IDEs: Diff panel handles deleted binary files without error

Selecting a deleted binary file in Pending Changes previously caused the Diff panel to throw a NullPointerException because the plugin attempted to load a missing Revision/workspace info. The Diff panel now skips loading content for deleted binary revisions and displays a clear message instead of crashing.

#### All platforms - Plugin for JetBrains IDEs

All platforms - Plugin for JetBrains IDEs: Fixed Cannot init component state VcsOperationLog on startup

Now plugin no longer throws Cannot init component state (componentName=VcsOperationLog) exception on startup; persisted offline operations are handled robustly and safely.

***

## 11.0.16.9692

> **Note:**
>
> **Public** | 2025-10-16

### New

#### All platforms - Plugin for JetBrains IDEs

All platforms - Plugin for JetBrains IDEs: Asynchronous VFS Processing

The processing of file system changes has been improved to run asynchronously, preventing main thread blocking and enhancing overall plugin performance and responsiveness during intensive file operations.

### Bug

#### All platforms - Plugin for JetBrains IDEs

All platforms - Plugin for JetBrains IDEs: Preserve external file renames/moves during refresh instead of converting to delete+add

When a file was moved via the OS file explorer, the desktop app correctly marked it as Moved, but opening the Rider plugin converted it to a Delete + Add pair. This behavior has been corrected, during refresh, external renames/moves are now detected and preserved as a single move/rename operation, preventing spurious add/delete changes and keeping version history intact.

#### macOS - Desktop GUI

macOS - Desktop GUI: Download correct installer when updating in ARM

When updating to a new version from the application on macOS, we were not taking into account the OS architecture, and always downloaded the installer for Intel-based processors. Now if you are using a Silicon Mac, the ARM version of the application will be installed on the upgrade

#### macOS Tahoe – Server

macOS Tahoe – Server: The server could not generate a self-signed certificate on macOS Tahoe.

In macOS Tahoe, the server failed to generate a self-signed certificate.

The server automatically generates a self-signed certificate when it is configured to listen on a secured port through `network.conf` and no other certificate settings are provided for that port. The same applies to the HTTPS port used by WebAdmin.

```text
# network.conf
[
  {
    "port": 8088,
    "security": "ssl"
  }
]
```

Starting with macOS 26 (Tahoe), changes in the Keychain subsystem prevented the `plasticd` process from creating a valid self-signed certificate, resulting in the following error:

```text
The specified item is no longer valid. It may have been deleted from the keychain.
```

This issue has now been fixed.

***

## 11.0.16.9677

> **Note:**
>
> **Public** | 2025-10-09

### New

#### All Platforms – All Clients

All Platforms – All Clients: Improved shelveset creation with Smart Locks

Previously, the "Shelve" operation failed if it encountered files that cannot be checked-out due to exclusive check-out rules.

Now, the operation succeeds by creating the shelveset and including those files without requiring a check-out.

This enhancement applies to both partial and regular workspaces.

### Bug

#### Windows - Desktop GUI

Windows - Desktop GUI: Fixed dialog focus on first click

For some modal dialogs in the application, when you first clicked on them they were losing the focus, requiring a second click to focus them again and be able to use them. We fixed this issue, and now on the first click the focus is kept.

***

## 11.0.16.9656

> **Note:**
>
> **Public** | 2025-10-02

### New

#### Windows - plasticfs

Windows - Dynamic workspaces: Add the modification status for checked-out files.

The Pending Changes view now accurately reflects the status of your files. Previously, when using a dynamic workspace (plasticfs), checked-out files were always shown as unchanged, even after being modified. This issue has been fixed, and the view now correctly displays these files as changed when they have been modified.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Added support for updated Jira REST API search endpoints

Enhanced Jira integration with intelligent endpoint detection that automatically uses the new search/jql API when available and gracefully falls back to the legacy `search?jql` endpoint when needed, ensuring seamless compatibility across all Jira versions without requiring any configuration changes.

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Allow selecting the Branch Base when creating new branches

The Create Branch dialog now allows you to choose the base branch when creating a new branch from the quick branch selector (toolbar popup).

If your current branch is not the main branch, you'll see an option to select either the main branch (default) or your current branch as the base. When working from the main branch, this option will be hidden.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/acc43f486f8f002f253e34d97b0ba9091d563e93df7111099032d0db3ada633e.png)

### Bug

#### All Platforms - Server

All Platforms - Server: Fixed incorrect lock release in undo/check-in operations across workspaces.

Scenario addressed:

* Two users, X and Y, and an admin, A.

* X locks a file and then goes on holiday.

* Y needs the file and asks the admin to unlock it (either with Release or Remove).

* Y locks the file and begins working on it.

* X returns, notices they have the file checked out (but not locked, as Y now holds the lock), and performs an Undo Checkout.

* This mistakenly removes Y's lock, even though it was acquired in a different workspace.

Now, the check-in and undo operations only update or release locks that were acquired in the same workspace where the operation is executed. Locks from other workspaces are ignored.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Fixed global configuration for unified organizations (@unity)

An issue that was preventing the global configuration from syncing correctly when using unified organizations has been resolved. Global configs, such as issue tracker integrations, now download automatically, and the expected folders under `AppData/local/plastic4/globalconfig` are created again, including all global configuration files like ignore.conf. With this fix, both legacy and unified organizations now support global configuration successfully.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Fixed horizontal scrolling issue on tables

There was a problem when scrolling horizontally and then vertically on tables, where some rows were shown with misaligned cells. This issue is now fixed and scrolling works as expected

#### All platforms - Plugin for JetBrains IDEs

All platforms - Plugin for JetBrains IDEs: Removed disruptive "Nothing was found to add" dialog

We suppressed a repetitive and hard-to-dismiss notification dialog that gets triggered when no items are detected for certain Add or Checkout operations. While we delivered a set of mitigations in previous releases, some users reported new occurrences of this dialog in certain scenarios where it negatively affects the user experience, offering no extra value.

***

## 11.0.16.9637

> **Note:**
>
> **Public** | 2025-09-18

### New

#### All platforms - Command-line client

All platforms - Command-line client: Personal Access Tokens are now available from the command line for Cloud organizations

Personal Access Tokens (PATs) allow you to authenticate non-interactive workflows (CI/CD, scripts, tools) against our Cloud service without sharing your password or compromising any other credentials.

You can use the `cm accesstoken` command family to manage your tokens. The PATs feature is opt-in, and access is controlled by the organization administrator — more on that later!

The process starts by creating a PAT. When using the command line (the feature is not yet available in the Cloud web portal), you must specify a description and a lifetime for the token. In this example, the token will be valid for 30 days:

```text
$ cm accesstoken create "My script PAT" 30d my-org@cloud
          Id  2023d611-fa69-46c5-b8b4-4e405c780bb7
 Description  My Script PAT
       Owner  you@your-org.com
  Created at  8/4/2025 4:10:57PM
  Expires at  9/3/2025 4:10:57PM
Last used at  Never
```

Once the PAT is created, you can reveal it. Revealing the PAT displays the actual token you can later use in your workflows:

```text
$ cm accesstoken reveal 2023d611-fa69-46c5-b8b4-4e405c780bb7 my-org@cloud
eyJhbGciOiJkpXVCJ9.eyJzdWIiOiIAyMn0.KMUFsI-QV30

$ cm ci -c="This checkin runs in our CI/CD VM" \
    --username=you@your-org.com \
    --token=eyJhbGciOiJkpXVCJ9.eyJzdWIiOiIAyMn0.KMUFsI-QV30 \
    --workingmode=LDAPWorkingMode \
    --server=my-org@cloud
```

Users can audit their own tokens: list them, check when they were last used, and delete them. Organization administrators can audit both their own tokens and the tokens of other users in the organization.

```text
$ cm accesstoken list my-org@cloud
// A list with my own PATs

$ cm accesstoken admin list-all my-org@cloud
// A list with all the PATs in the organization

$ cm accesstoken revoke 2023d611-fa69-46c5-b8b4-4e405c780bb7 my-org@cloud
// Revoked my own PAT

$ cm accesstoken admin revoke 5d08dbec-edaa-4415-b709-25042fa13517 my-org@cloud
// Revoked a PAT from a different user in my organization
```

Organization administrators can also manage who has access to the PATs feature. As mentioned earlier, this is an opt-in feature rather than opt-out. This ensures that only privileged users and groups can grant access to organization data through a PAT.

```text
$ cm accesstoken allowlist show my-org@cloud
```

To grant access to the feature to all current and future users, add the special user 'all' to the allowlist:

```text
$ cm accesstoken allowlist add --users="all" my-org@cloud
```

To grant access to all users in a specific group (for example, "QA-hq"), add the group to the allowlist instead. If a user is removed from the group, they lose the privilege. Likewise, users added to the group gain the privilege.

```text
$ cm accesstoken allowlist add --groups="QA-hq" my-org@cloud
```

The feature is currently available only through the command line client and will soon be available in the Cloud portal. Personal Access Tokens replace the old `plasticscm.com`'s feature named "API Keys", that could be accessed from the "Edit Account" section on the old dashboard.

It is worth mentioning that PATs are valid only for the account and organization they were created against, whilst the old API Keys were account-wide and granted access to all the organizations the user was a participant of.

### Bug

#### All platforms - Plugin for JetBrains IDEs

All platforms - Plugin for JetBrains IDEs: Fixed `<local2> is null` error during startup

Resolved an issue where the plugin for JetBrains IDEs could encounter a `<local2> is null` error during the startup process. This error was caused by an unhandled exception in the file checker module, which led to the error message being written to the IDE logs and could potentially interfere with plugin initialization in certain environments. The underlying exception handling has been improved to prevent this issue from occurring, ensuring smoother startup and more reliable plugin behavior across all supported JetBrains IDEs.

#### All platforms - Plugin for JetBrains IDEs

All platforms - Plugin for JetBrains IDEs: Fixed unresponsive "Nothing was found to add" dialog

This update completes an earlier fix for the "Nothing was found to add" dialog. In some cases, the dialog could still freeze the plugin and block input. We've now adjusted how dialogs are opened to follow JetBrains' recommendations for threaded processes, ensuring the dialog closes correctly or remains responsive as expected.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Fixed initialization of the HtmlRenderer component

Fixed an issue that could cause the desktop application to throw an unexpected error during startup on certain system configurations. The initialization logic has been updated to handle these edge cases gracefully, resulting in more robust application startup and improved reliability for users on all supported platforms.

#### All Platforms - All clients

All Platforms - All clients: Fixed issue with revert operation failing due to path reused by different items

Previously, the revert operation for a directory would fail if the target revision attempted to load an item (file or directory) using a path already occupied by another item in the workspace.

The operation now successfully unloads the existing workspace item to load the item from the target revision.

***

## 11.0.16.9615

> **Note:**
>
> **Public** | 2025-09-04

### Bug

#### All platforms - Plugin for JetBrains IDEs

All platforms - Plugin for JetBrains IDEs: Fixed unresponsive "Nothing was found to add" dialog

Resolved a condition where the "Nothing was found to add" dialog from the Plastic SCM integration could be displayed in a way that would block the UI thread. The dialog now functions as expected and will no longer cause the application to hang.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Fixed null exception in labels view

Fixed a null reference exception that occurred when opening the Labels view while a branch filter was applied in the Changesets view. Previously, this issue could cause the Labels view to fail loading (or refreshing) under these conditions. The Labels view now opens and refreshes correctly regardless of branch filters applied in the Changesets view.

#### All platforms - Server

All platforms - Server: Fixed array dimensions exceeded supported range error

Fixed an issue in the Branch Explorer where certain migrated Git repositories triggered an "Array dimensions exceeded supported range" error, preventing the graph from being displayed. The root cause was on the server side: some changesets without changes were created with an empty GUID, which led to the error in the Branch Explorer. This has been corrected, and the Branch Explorer now correctly renders graphs for all migrated Git repositories.

***

## 11.0.16.9579

> **Note:**
>
> **Public** | 2025-08-06

### New

#### Windows - All Clients

Windows - All Clients: Improved Path Canonization Performance

We've optimized how clients handle file paths on Windows across all commands.

Path canonization - which resolves symlinks, corrects casing to match the file system, and normalizes paths - now runs 30% faster. While each operation is lightweight, performance gains add up significantly when processing many paths. This improvement boosts overall efficiency in path-heavy workflows.

#### macOS - Installers

macOS - Installers: Added support for ARM architecture in UVCS installers

ARM installers are now available for macOS UVCS.

This update allows users on Apple Silicon (M1/M2/M3) devices to install and run UVCS natively without relying on Rosetta emulation. This improves performance and compatibility for the latest macOS hardware.

#### All Platforms - All Clients

All Platforms - All Clients: Enhanced shelveset application

Previously, the "Apply Shelve" operation would fail entirely if it encountered files that could not be checked out due to exclusive checkout rules. No changes were applied, and the operation simply stopped.

Now, the operation has been improved to handle such cases more effectively. It can apply changes directly to the disk for files that cannot be exclusively checked out, without requiring a checkout. At the end of the operation, a report is provided, listing any errors for files that could not be checked out.

This enhancement applies to both partial and regular workspaces.

#### All Platforms - Command Line Client

All Platforms - Command Line Client: Added the --dontcheckout option to skip checkouts when applying a shelveset.

The "cm shelveset apply" and "cm partial shelveset apply" commands now include a new --dontcheckout option. This allows users to apply shelvesets (saved sets of pending changes) without checking out conflicting files or modified files, leaving them as local changes instead.

This option is particularly useful for avoiding exclusive checkout restrictions when applying a shelveset.

### Bug

#### All Platforms - Plugin for JetBrains IDEs

All Platforms - Plugin for JetBrains IDEs: Supported file operations for ignored files

File operations (create, delete, move, rename) now work on files listed in ignore.conf (the configuration file that specifies which files to exclude from version control). Previously, these actions failed because ignored files were mistakenly treated as part of the VCS.

***

## 11.0.16.9546

> **Note:**
>
> **Public** | 2025-07-24

### New

#### Command-line client

Command-line client: Faster checkout for thousands of files with cm

We recently improved checkout performance when handling large numbers of files. Files are now grouped by their parent directory and processed in batches, reducing overhead and speeding things up. In our tests, checking out 15,000 files from the same directory in the Desktop GUI dropped from 30 seconds to just 3 seconds - a 10x improvement. However, cm was significantly slower due to the need to process the input paths right before running the actual checkout operation.

Additional optimizations were applied to this release, especially improving performance on Windows. Thanks to that, the checkout with cm goes from the original 46 seconds to just 10 seconds - almost an 80% reduction.

* Tested on a modern machine with a 10th-gen Intel i9 CPU and SSD running Windows 11.

#### All platforms - Plugin for JetBrains IDEs

All platforms - Plugin for JetBrains IDEs: Embed Clone UVCS repository workflow into "Get from Version Control" dialog

To align with recent IntelliJ API changes, we have updated the Clone functionality. Instead of launching a separate dialog wizard, the workflow is now fully embedded within the main "Get from Version Control" dialog. This provides a more seamless and integrated user experience.

### Bug

#### All platforms - Desktop GUI and Gluon

All platforms - Desktop GUI and Gluon: Pending Changes View no longer refreshes unexpectedly

We've resolved an issue introduced in previous version 11.0.16.9523 that caused the Pending Changes view to auto-refresh unexpectedly, even when the Auto-refresh setting was disabled. This could interrupt workflows—such as reviewing a long list of diffs—by jumping back to the top of the list.

The auto-refresh behavior now correctly respects your configuration. Additionally, we now avoid interrupting your work with save/discard prompts while editing files with unsaved changes.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Fixed "Switch to" operation didn't refresh current loaded branch/changeset

The "Switch to branch/changeset" operation did not trigger a UI refresh (e.g., topbar, Branch Explorer) upon completion when certain errors were encountered during execution—such as missing Xlink references.

This issue has now been resolved.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Pending Changes view is now properly refreshed after merges

Resolved a regression introduced in previous version 11.0.16.9523 where the Pending Changes view did not auto-refresh after completing a merge if auto-refresh was disabled in the pending changes options. Now it's fixed.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Fixed launch SemanticMerge as standalone null exception

An error was raised while running the Semantic Merge tool from the command line with unsupported file formats and using the sorted files arguments format.

```console
sortedFiles: <filename1> <filename2> <filename3> <filename4> <fileparamorder>
- or -
unsortedFiles: <sourceFile> <destinationFile> <baseFile> <resultFile>
                  sourceFile:        {-s | --source}=<filename>
                  destinationFile:   {-d | --destination}=<filename>
                  baseFile:          {-b | --base}=<filename>
                  resultFile:        {-r | --result}=<filename>
```

```console
$ plastic semanticmerge v1\README.md v2\README.md
```

Now, this mode (sortedFiles) is not failing for unsupported file formats.

#### All platforms - Plugin for JetBrains IDEs

All platforms - Plugin for JetBrains IDEs: Fixed Create workspace action not available

Now the "Create Plastic SCM workspace..." action under VCS main menu will be only visible for those projects which are not under a UVCS workspace, otherwise it will be hidden.

#### macOS GUI

macOS GUI: Fixed crash that prevented the application from running on macOS 26 Beta

Whilst we don't provide official support for OS beta releases, we are grateful to the intrepid users who upgrade early and report these kind of bugs!

#### Linux - Installers

Linux - Installers: Fixed resolution of libicu dependency on Ubuntu 25.04

Some Ubuntu distros were showing an error while installing telling that there is an unmet dependency of `libicu` that cannot be resolved.

Now it is fixed, since `libicu76` is now set as a valid alias for `libicu` dependency.

***

## 11.0.16.9523

> **Note:**
>
> **Public** | 2025-07-10

### New

#### All platforms

All platforms: Faster checkout for thousands of files

We've significantly improved checkout performance when handling large numbers of files. Files are now grouped by their parent directory and processed in batches, reducing overhead and speeding things up.

In our tests, checking out 15,000 files from the same directory in the Desktop GUI dropped from 30 seconds to just 3 seconds—a 10x improvement. (Tested on a modern Windows machine with a 10th-gen Intel i9 CPU and SSD).

#### All platforms

All platforms: Faster status (pending changes)

Good news: Pending changes status updates are now 3-4 times faster! You'll experience the biggest boost in speed after a machine restart, for the very first calculation on any Unity Version Control client, and with every calculation on the command-line interface (CLI).

This enhancement will especially benefit users running Unreal Engine 5 projects with One File Per Actor (OFPA) enabled, along with those who manage large workspaces that can contain hundreds of thousands of directories.

#### All platforms - Desktop GUI and Gluon

All platforms - Desktop GUI and Gluon: Pending Changes Status in the Top Bar

We've introduced a new mechanism that monitors your pending changes and updates the status overlay in the top bar. The working object icon now clearly displays a blue dot overlay when pending changes are detected, making it easier to track work that needs to be committed.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/6eb2f870bee902dc88317f176dad25f28a3934c1df9243643360d6d4a4a12761.png)

### Bug

#### All platforms - Server

All platforms - Server: LDAP groups are not always identified as groups

When using an LDAP server, some groups were wrongly identified as users instead. This can happen with some LDAP providers like OpenLDAP.

We fixed that, and now they are properly told apart.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: LDAP user names weren't shown in the 'Changeset colors' panel

When using LDAP, user SIDs were shown instead of their names in the 'Changeset colors' panel, located in the Branch Explorer.

We changed this to shown the actual name of the user. If you already have some users added there, you can remove the entries and add them again so the display name gets updated.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Fixed closing the ephemeral notification banner

The app showed a "A task was cancelled" error after manually closing the notification banner.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Branch Explorer runs 'before-merge' trigger when there are incoming changes

When you are not on the head of a branch, refreshing the Branch Explorer used to execute the 'before-merge' triggers. We fixed that: now you have to actually press the 'View' button in the toolbar.

***

## 11.0.16.9494

> **Note:**
>
> **Public** | 2025-06-25

### New

#### Windows - Desktop GUI

Windows - Desktop GUI: Drag & drop files from Workspace Explorer to external destinations

You can now drag and drop files from the Workspace Explorer tree view to any location on your file system. This also includes the ability to open files directly in external applications (e.g., Notepad).


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/7dc01603b3711618496f2e75488c1c1a764c600c1eab03fcf0520882fad16128.gif)

### Bug

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Fixed broken link to Dynamic Workspaces documentation

The URL for the Dynamic Workspaces documentation has been updated. It now correctly points to:

[/unity-version-control/dynamic-workspaces](/unity-version-control/dynamic-workspaces.md)

***

## 11.0.16.9478

> **Note:**
>
> **Public** | 2025-06-12

### New

#### All platforms - Gluon

All platforms - Gluon: Support for custom client messages from OnPremise servers

The customizable banner available for OnPremise servers is now supported by the Gluon client.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/0364a461e34eed5eb86c493890a2b3a976f3c54ad44d823536602ededd6b2313.png)

#### Command-line client

Command-line client: New `cm getconfig organization` command

This new command will retrieve the information of a Cloud organization stored in the configuration.

```console
$ cm getconfig organization MyUnityOrg@unity
MyUnityOrg unity 123456789012 euwest-01.contoso.com
```

You can use `--format` to change the output:

```console
{0} | {orgname}         Version Control organization name.
{1} | {type}            Type of organization ('cloud' or 'unity').
{2} | {orgid}           Unity Organization ID.
{3} | {region}          Server location.
```

If no organization is explicitly passed and the cm is within a workspace, it will return the organization information of the workspace. Otherwise, it will show the information of the default organization.

### Bug

#### Command-line client

Command-line client: Restore checkout as visible in showcommands

Using showcommands hid the `checkout` command but displayed the deprecated `undocheckout` command. This has been corrected.

***

## 11.0.16.9466

> **Note:**
>
> **Public** | 2025-06-05

### New

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Added List/Tree mode switcher to Available branches dialog

It is now possible to visualize the list of available branches as a tree view in the "Available Unity VCS branches" dialog, and switch between 2 modes: list and tree.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/84c33e489a2174e274be3032d655d8878dc2cfdcdb230c7e2d1a6c2298dcbc5e.png)


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/ee1f862190ba8e4bd65988c67c4f36eba7e3b842adc2faf74c46fd35be677f9f.png)

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Persistent the tab selection while changing workspace

If a new workspace is loaded in the application, the Workspace view will be displayed. Otherwise, the last opened view will be displayed. Additionally, the latest loaded view will persist when the application is opened.

#### Linux - Installers

Linux - Installers: Debian and Ubuntu won't fail if 'xdg-mime' tool isn't installed

From now on, if `xdg-mime` tool (from `xdg-utils` package) is not installed in the operating system, the installation of `plasticscm-client-gui` package won't fail.

Instead, the custom `plastic://` links (code review links, changeset links, etc) won't be recognized and hence won't be shown in the GUI application when clicking on them.

If this happens, we recommend installing `xdg-utils` package in the system to ensure the custom `plastic://` links are recognized, by running the following command:

```text
xdg-mime default /usr/applications/plasticx.desktop x-scheme-handler/plastic
```

***

## 11.0.16.9453

> **Note:**
>
> **Public** | 2025-05-29

### New

#### All platforms - Server

All platforms - Server: Support for custom client messages in OnPremise servers

Administrators of OnPremise servers now have the ability to force-display custom messages directly on the client side. Whether you're issuing a critical security alert, rolling out new usage policies, or just want to keep users informed about important updates, this feature puts communication front and center.

\== How do I use it? ==

This new functionality is available under the WebAdmin section "Advanced -> Global security settings -> Custom client message", and supports a basic subset of HTML tags.

E.g.

```text
<p style='background-color:#FFCCCB; padding:8px; margin:0; font-size:12px;'>
    <b>CONFIDENTIAL INFORMATION NOTICE</b> -
    You are accessing protected content. <b>DO NOT</b> share, copy, or distribute without proper authorization.
</p>
```

Once set, clients connecting to any workspace under the server will display a banner with the configured notice.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/ecc09eb3b89b1f7956aeb069234047f7ebedadea6daf14de0aec2b1a6d5721cd.png)

\== Who can remove the banner? ==

Only administrators can remove it by reseting the "Custom client message" field in the WebAdmin.

\== A note on visibility ==

This feature is currently supported by the Unity Version Control desktop client, and will be extended to Gluon in a future release.

### Bug

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Fixed opening plastic links for migrated @unity organizations

Previously, plastic links for code reviews or diff would fail to open with the Desktop GUI for newly migrated @unity organization having names in CamelCase. With this fix, it is now possible to open these links.

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Fixed broken onboarding in DVCS edition

The user account sign-in did not work as expected in the Home view for the  DVCS edition version. It was because the account was managed as a cloud account instead of an on-premises account.

Now the user can sign in to the local server and obtain the list of repositories for this server.

#### All Platforms - Server

All Platforms - Server: Merge rules now correctly enforced when using old repository names

Previously, if a client attempted a merge using the repository name that existed before a rename, the server would bypass merge rule validation. This issue has been resolved - merge rules are now correctly applied even when the client refers to the repository by its old name.

***

## 11.0.16.9411

> **Note:**
>
> **Public** | 2025-05-15

### New

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Issue trackers - Supported `MULTIPLE_PROJECTS` configuration

Now, Jira issue tracker extension accepts `MULTIPLE_PROJECTS` value for the Project key configuration parameter.

This way, each branch explicitly contains the project key of its related task, instead of defining a global project key for all branches.

### Bug

#### All Platforms - Server

All Platforms - Server: Merge rules are now correctly updated when a repository is renamed.

Previously, renaming a repository caused its associated merge rules to retain the old repository name, resulting in the rules being ignored. With this fix, the repository name in affected merge rules is properly updated upon renaming.

Note: This fix does not apply to merge rules that use wildcard patterns.

#### All Platforms - Server

All Platforms - Server: Trigger filters now correctly handle repository renames.

Previously, when a repository was renamed, the associated trigger filters retained the old repository name, causing the triggers to be ignored. With this fix, the repository filters in affected triggers are properly updated upon renaming.

More info about trigger filters [here](/unity-version-control/triggers/concepts/filters.md).

#### All platforms - DevOps

All platforms - DevOps: Mergebots now correctly handle repository renames.

Previously, when a repository was renamed, associated mergebots continued referencing the old repository name. This caused them to stop functioning, even after a restart, unless their configuration was manually updated.

With this fix, mergebot configurations are automatically updated when a repository is renamed, allowing them to continue working seamlessly.

It applies to trunkbot & conflictsbot.

#### Windows - Installers

Windows - Installers: Enterprise Edition installer didn't start the GUI client app

Since the 11.0.16.9243 version, installing the Enterprise Edition of the product didn't automatically run the GUI client app (plastic.exe) at the end of the install process. Now it's fixed and the GUI client app will run after finishing the install/upgrade process, as usual.

***

## 11.0.16.9396

> **Note:**
>
> **Public** | 2025-05-08

### Bug

#### All platforms - Plugin for JetBrains IDEs

All platforms - Plugin for JetBrains IDEs: Fixed diff operation for unity organizations

We fixed an issue provoking the diff panel to fail loading the content of a remote revision under certain conditions.

#### Server

Server: Restore cm find ability to return parent changesets along with hidden branches

Let's say we have the following changesets:

```text
cs:41 <--- cs:42 <--- cs:43 (/main)
```

You could retrieve the parent of the changeset 43 with the following command:

```text
cm find changeset "where changesetid = 43 and returnparent = 'true'  on repository 'repo@organization@cloud'" --format="{changesetid}"
42
```

However, if you hid any other branch in the repository at some point, the same command would wrongly return the grandparent changeset:

```text
cm find changeset "where changesetid = 43 and returnparent = 'true'  on repository 'repo@organization@cloud'" --format="{changesetid}"
41
```

We fixed this error so it works properly no matter what.

***

## 11.0.16.9370

> **Note:**
>
> **Public** | 2025-04-24

### New

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Added copy changeset/shelve link to notifications

When performing a check-in or shelve, users can now easily open and copy diff and shelve links directly from the success notifications displayed at the bottom. Notifications also include links to open the recently created changeset or shelve, improving navigation and sharing changes with other users.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/47eb51bd2083c430815bd3e674975c9f538d18b69e0303bfe8f2da0fc60d532d.png)


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/f954a0de3f05773fa96b93407172fe54459db72dbb251f40ab408136ecec0cd8.png)

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Issue trackers - Supported branch names with description

Before this change, issue trackers only supported branch names with format: `{branch_prefix}{taskId}`.

Now, users can use different formats of branch names `{branch_prefix}{taskId}{any_text}`. For example:

* `xxx123456`

* `xxx123456MyTask`

* `xxx123456-my-task`

* `xxx123456_my-task`

* `xxx123456 My Task`


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/0f55486f1869d7c2dea96adb38bf36879b7ae07664375c654bf112e03292387a.png)

### Bug

#### Command-line client

Command-line client: Client API now handles modules properly

When using the `cm api` command, endpoints taking a repository in the route were not properly handling submodules, preventing its use.

We fixed it to work as intended. Please remember to escape the repository separator when using submodules on routes!:

```text
# / -> %2F
curl http://localhost:9090/api/v1/repos/project%2Frepository@MyOrg@cloud
```

***

## 11.0.16.9343

> **Note:**
>
> **Public** | 2025-04-10

### New

#### DevOps Mergebots

DevOps Mergebots: Jira plug now writes the Release Date field on new version creation

From now on, the Jira integration for Mergebots writes the "Release Date" field on "createrelease" action (new Jira version creation).

Before, just the version name and description were set.

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Improved support for workspace-related actions in Plastic links

When opening a Plastic link, the application now enables workspace-related actions—such as diff, undelete, history, and annotate—in the Diff or Code Review window. It automatically selects the most recent workspace associated with the Plastic link's repository. If no workspace is found, these actions are just disabled (as previously) to ensure a consistent user experience.

#### All platforms - Desktop GUI and Gluon

All platforms - Desktop GUI and Gluon: Added option to diff the changeset of moved and deleted history items

Before, accessing the changeset diff was only possible for history items that represented new revisions with actual changes.

Now you can quickly open the diff tool in the history view from a moved or deleted item out of convenience.

### Bug

#### Command-line client

Command-line client: Fix for incorrect .plastic renaming issue

Previously, it was possible to delete a file and then use the `cm move` command to rename another file as the workspace configuration directory (`.plastic` by default):

Example of the sequence that causes the problem:

```text
> del foo.c
> cm mv foo.c .plastic
foo.c has been moved to .plastic
```

While the file wasn't actually renamed on disk and the directory remained intact, this behavior was unintended and could cause confusion.

From now on, renaming any file to `.plastic` won't be possible (to prevent reaching an inconsistent workspace status) and will show the following controlled error message instead:

```text
Can't move. Destination already exists. Overwriting items is not allowed.
```

#### Command-line client

Command-line client: Fix 'no such user or group' error when editing the ACLs

When using the `cm acl` command, users and groups were wrongly solved against your default server (the one set up in your client.conf file). This led to errors or unexpected behavior when targeting a different repository.

#### Command-line client

Command-line client: Fix 'no such user or group' error when setting the owner of an object

When using the `cm setowner` command, users and groups were wrongly solved against your default server (the one set up in your client.conf file). This led to errors or unexpected behavior when targeting a different repository.

#### Command-line client

Command-line client: Improved GitHub LFS Syncing

We have fixed an issue when syncing GitHub repositories containing large files (over 2 GB) using the command-line client.

With this fix, the cm sync command now handles pulling files exceeding 2 GB.

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Fixed Branch Explorer Label menu

Fixed an issue where label context menu actions in the Branch Explorer (rename, delete, etc.) worked only the first time, then stopped responding on subsequent attempts. All label menu items now function consistently for multiple operations.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Incorrect Error Message

Fixed an issue where an incorrect error message was shown when attempting to apply changes from a shelf.

The error message now correctly describes the issue, providing accurate information about what went wrong.

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Double-clicking a file from a Plastic link causes an error

Previously, double-clicking a file in a Plastic link (e.g., in code reviews or branches) caused a NullReferenceException. This issue has been resolved by ensuring the application verifies whether the diff action is available before executing the double-click operation.

#### All platforms - Plugin for JetBrains IDEs

All platforms - Plugin for JetBrains IDEs: Branch detection after external switch

Fixed an issue where the IDE failed to detect the current branch correctly after the workspace branch was switched externally.

***

## 11.0.16.9293

> **Note:**
>
> **Public** | 2025-03-20

### New

#### All platforms - Server

All platforms - Server: HTTP request and response buffer sizes are now configurable.

If you use the Unity Version Control WebAdmin tool and/or APIs, you can now configure the HTTP request and response buffer sizes. Bear in mind that this is a server-side configuration, so it can only be customized by on-premise Plastic accounts.

Configuring these buffers' sizes can be useful, for example, to increase throughput in high-latency networks, or, in memory-constrained scenarios, to support more concurrent clients through HTTP.

You can control both settings using the following server.conf configuration keys:

```xml
<WebAdminToolMaxRequestBufferSizeInBytes>-1</WebAdminToolMaxRequestBufferSizeInBytes>
<WebAdminToolMaxResponseBufferSizeInBytes>131072</WebAdminToolMaxResponseBufferSizeInBytes>
```

Not specifying the new configuration key, or using a value of -1, indicates that the default buffer size (1MB for requests, and 64KB for responses) should be used.

#### All platforms - Server

All platforms - Server: Enhanced control over audit.log file management

Two new configuration keys have been added to the server.conf, allowing you to control audit log file rotation and retention:

```xml
<AuditLogMaxSizeInMB>100</AuditLogMaxSizeInMB>
<AuditLogMaxFiles>2</AuditLogMaxFiles>
```

Setting AuditLogMaxSizeInMB enables the automatic rotation of audit.log files. When a log file reaches the specified size, it is renamed with a timestamp, following the pattern:

```text
audit_yyyyMMdd_HHmmss_fff.log
```

For example:

```text
audit_20250304_103250_657.log
```

If AuditLogMaxFiles is set, the server will retain the current log file plus the specified number of rotated files.

This update gives you more flexibility in managing log file growth and retention!

### Bug

#### All Platforms - Gluon

All Platforms - Gluon: Security changes now properly update cached changeset trees

Gluon workspaces cache server changeset trees to enhance performance. However, security changes on the server were not properly reflected in the cached trees, potentially leading to outdated visibility information.

Now, Gluon correctly detects security changes on the server and updates the local cache accordingly.

***

## 11.0.16.9271

> **Note:**
>
> **Public** | 2025-03-13

### New

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Support for legacy workspaces in upcoming organization migration ([more info here](/unity-version-control/cloud-repositories/landing.md), in our dedicated technical documentation)

This update prepares the Desktop GUI for the upcoming migration from legacy cloud organizations to unified Unity organizations. Changes have been implemented to ensure that workspaces created using the legacy format will remain visible in the repositories list, and they will be properly linked to their repositories after the migration.

Users can expect a smooth transition with backward compatibility for existing workspaces when the migration takes place later this year.

### Bug

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Workspace Explorer context menu wrongly updated

The 'New' and 'Change revision type' context menu options were incorrectly computed using the previously right-clicked item instead of the current one.

Right-clicking a directory followed by a file could allow unintended options like "New" to be available. The behavior has been fixed! The context menu now correctly updates based on the currently selected item.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/6172aa5f9597abbbe695a21a5ae3e64f74caae10cfda6cfcb4dcdf828291da6b.png)

#### Command-line client

Command-line client: Prevent credentials prompt for @unity organizations when using username/password or token

We've fixed an issue affecting the command line client when determining the datacenter for the new unified organizations (`name@unity`).

* When running `cm configure` in non-interactive mode, the provided username/password or token will now be correctly used to resolve the datacenter. This prevents the client from stalling due to unnecessary credential prompts.

```text
cm configure --language=en --username=your@mail.com --token=eyXYZjdt --server=org@unity --workingmode=SSOWorkingMode
```

* For all other commands, if credentials are explicitly provided (via username/password or token), they will also be used to resolve the datacenter. This fixes the previous behavior where the command would fail with an error.

```text
cm repository list org@unity --username=your@email.com --token=eyXYZjdt --server=org@unity --workingmode=SSOWorkingMode
repo_1@org@unity
repo_2@org@unity
```

This update ensures a smoother experience when working with `@unity` organizations by correctly handling authentication in all cases.

***

## 11.0.16.9243

> **Note:**
>
> **Public** | 2025-03-06

### New

#### Windows - Installers

Windows - Installers: Simplified install cycle with less steps

* Removed redundant "Start Classic GUI or Gluon" question, since the first startup after a fresh install already asks for this choice.

* Removed component selection window, since it allowed the installation of the Eclipse plugin, which is still possible by copying the bundled plugins .jar files located at `$INSTALL_DIR/client/plugins/eclipse` directory.

A "README.txt" file can be found in that directory with installation instructions.

Besides that, the "More installers and other Operating Systems" section of [https://www.plasticscm.com/download](https://www.plasticscm.com/download) enables downloading a "Plugins zip" file containing all java-based plugins, including eclipse plugin.

#### All platforms - Command-line client

All platforms - Command-line client: Incoming Changes support for 'cm partial update' command

A new '--incoming' option has been added to the 'cm partial update' command, aligning its behavior with Gluon. This enhancement scans for local workspace changes and applies only those relevant to the operation. Additionally, it will attempt to automatically merge any file conflicts it encounters.

### Bug

#### All platforms - Command-line client

All platforms - Command-line client: Fixed issue when running merge-to outside of a workspace

When trying to run a merge-to operation while the current working directory is not inside a workspace, we were showing an error. Now you can successfully complete the merge-to from any location.

#### All platforms - Gluon

All platforms - Gluon: Check-in failure when reverting a directory with moved items

Fixed an issue where Gluon failed to check in a directory revert operation if any item had been moved between the workspace revision and the reverted revision. The operation would throw the error: "An item with the same key has already been added." This issue has now been resolved.

#### All platforms - Gluon

All platforms - Gluon: Fixed checkin success message

After performing a checkin in Gluon, we show a notification at the bottom telling that the operation was completed successfully. This message was notifying of a successful shelve operation, instead of a checkin. We fixed the text of the notification.

#### All clients

All clients: Incoming Changes may incorrectly flag files as modified despite no actual changes

After resolving a file conflict, the Incoming Changes operation did not update the file's local information. As a result, the file may incorrectly appear as "changed" even when no modifications were made, and this issue could persist even after checking the file in. Fixed.

***

## 11.0.16.9213

> **Note:**
>
> **Public** | 2025-02-20

### New

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Next/Previous diff shortcuts

We've restored the Ctrl+N and Ctrl+M (Cmd+N and Cmd+M in macOS) shortcuts to navigate between differences in the Diff Control.

Now you can move to the next/previous/first/last change without using the mouse.

We also improved focus handling, so these shortcuts work immediately when a diff window or code review is opened.

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Improve PlasticFS (dynamic workspaces) setup

* The command-line option to start the PlasticFS agent has been renamed from --install to --add-to-startup for better clarity.

* The EnableCreateDynamicWorkspace GUI configuration key has been removed, as it is no longer needed.

* The setup panel text has been rewritten to better explain what PlasticFS is.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/d4de9907c524814dab15e18e19cec4792c94e15dad4fb7cab5b7d0aa0463654c.png)

#### All platforms - Desktop GUI & Gluon

All platforms - Desktop GUI & Gluon: "Revert to this revision" for directories

"Revert to this revision" option is now enabled for directories from the history view.

We've also added the history view menu for directories in Desktop GUI bringing it in line with Gluon for a more consistent experience.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/546ccaaa14996e2bfd2ec7fab67cac49f7fd27f3ad176c36c352a2e5d33b0e2d.png)

#### All platforms - Plugin for JetBrains IDEs

All platforms - Plugin for JetBrains IDEs: Renewed icons in the plugin for the JetBrains IDEs

All the icons have been replaced with new designs used from the rest of the UVCS product suite.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/7df75daafe0f372e39f342a7ca5e7f99a4faab6d67624e7064815d3e2b39802f.png)

#### Server - All Platforms

Server - All Platforms: Lock rules now update automatically after renaming a repository

Previously, when a repository was renamed, any associated lock rules had to be updated manually; otherwise, they would no longer apply to the renamed repository.

Now, lock rules are automatically updated, ensuring they remain effective without requiring manual intervention.

### Bug

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Fixed wrong file for code review comment

Fixed an issue that placed user comments in the previously selected file rather than the intended file when adding comments after switching files from the "Find in files" results.

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: "Find in files" navigation in Diff Window

Navigating between different files in the Diff Window using "Find in files" caused incorrect scrolling and highlighting. Now it's fixed: Scrolling and highlighting correctly follow the chosen file.

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Disable "Add to Source Control" for Controlled Items

Selecting a controlled item together with private files in the Workspace Explorer, triggered an error when using "Add to source control."

Now, the option is only enabled if all selected items are private, preventing unexpected behavior for controlled items.

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Fixed Code Review Comment navigation

Previously, users needed multiple double-clicks to focus on regular code review comments due to a bug. Now, double-clicking a comment works as expected: it automatically centers and highlights the correct line.

#### All Platforms - Plugin for JetBrains IDEs

All Platforms - Plugin for JetBrains IDEs: Fixed plugin versioning

The project structure was adapted to properly version the plugin.

#### All Platforms - Plugin for JetBrains IDEs

All Platforms - Plugin for JetBrains IDEs: Fixed error about deprecated `ActionUpdateThread.OLD_EDT`

Solved an issue present in JetBrains IDEs version 2024 and above, where the system complained about using the deprecated API component `ActionUpdateThread.OLD_EDT`.

#### macOS - Plugin for JetBrains IDEs

macOS - Plugin for JetBrains IDEs: Fixed plugin not exported during installation

We fixed an issue in the mac installer that was preventing the new JetBrains plugin from getting into the installation folder.

***

## 11.0.16.9184

> **Note:**
>
> **Public** | 2025-02-13

### New

#### All platforms - Plugin for JetBrains IDEs

All platforms - Plugin for JetBrains IDEs: IntelliJ SDK upgraded to 2022.3

We have reformulated the plugin structure to make use of the IntelliJ Platform Gradle Plugin.

This change allowed us to securely upgrade our plugin to offer better support for JetBrains IDEs version 2022.3 and above.

The new version of the plugin is now distributed as a zip file under the plastic installation folder "client/plugins/intellij", and you can reuse this file across all your IDEs. We also include a README file with installation instructions alongside the plugin package.

#### Windows - PlasticFS

Windows - PlasticFS: Relocate the storage into a separate disk

By default, PlasticFS backing storage is located at %LocalAppData%\plastic4\plasticfs-storage. Now you can relocate yours into a different directory or disk.

For that, you can just create a plasticfs.conf file next to your client.conf file, also located by default at %LocalAppData%\plastic4.

Then write something like this inside the file:

```text
storagebasepath=D:\plasticfs-storage
```

The plasticfs-storage directory contains the PlasticFS shared cache among other things. The size of this subdirectory will grow as PlasticFS downloads file data on demand. If you want to move the shared cache in isolation, you can also do it, like this:

```text
sharedcachebasepath=D:\plasticfs-shared-cache
```

Now follow these steps:

1. Stop the PlasticFS tray application.

2. If you already have a plasticfs-storage directory, move it to its new location. The same goes for plasticfs-shared-cache if you want to move that one.

3. Restart the PlasticFS tray application, so the configuration file takes effect.

\== WARNING ==

If you want to preserve your existing workspaces, but you didn't follow the second step correctly, a brand new storage directory will be created at the new location and you will be prompted with an error by the tray application. Don't panic! This can be fixed by stopping PlasticFS and replacing that new storage directory with the old one.

### Bug

#### All platforms - Plugin for JetBrains IDEs

All platforms - Plugin for JetBrains IDEs: Fixed error updating files with pending changes

The "Update file/directory" feature has been changed to update the whole workspace instead of single items, and renamed to "Update Workspace", as this is how it should work for standard workspaces.

This way the use cases are,

* Update Workspace with no changes should load all the incoming changes.

* Update Workspace with changes and no conflicts should load all the incoming changes.

* Update Workspace with changes and conflicts should NOT load all the incoming changes and show this error message:

"Error:The update operation detected conflicts. The operation cannot continue since it was run with the --dontmerge option."

#### All platforms - Plugin for JetBrains IDEs

All platforms - Plugin for JetBrains IDEs: Annotate not supported from History revisions

The Annotate operation has been allowed for revisions listed in the History view.

#### All platforms - Plugin for JetBrains IDEs

All platforms - Plugin for JetBrains IDEs: Fixed java.lang.NoSuchMethodError issue

This error was raised because of the usage of a removed feature from the "com.intellij.util" package (`SystemProperties.getLineSeparator()`), the usage of this reference has been replaced by `System.lineSeparator()`, which is still being supported and it's not deprecated.

#### All platforms - Desktop GUI/Plugin

All platforms - Desktop GUI/Plugin: Ignore.conf is reformatted after adding a new file via the GUI

Fixed an issue where adding new rules caused the `ignore.conf`, `cloaked.conf`, or `hidden_changes.conf` files to be reformatted, which could result in the loss of comments.

Now, comments are retained when updating `ignore.conf`, `cloaked.conf`, and `hidden_changes.conf`.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Show the list of changesets when diffing a hidden branch

When opening the code review of a hidden branch, the list or changesets appeared empty. The same happened when diffing a hidden branch.

Now, the changesets list of the hidden branch is properly shown.

#### All platforms - Desktop GUI/Gluon

All platforms - Desktop GUI/Gluon: Improved shortcuts handling

We've resolved an issue where using certain keyboard shortcuts without a selection could cause unexpected errors.

For example: In the labels view, pressing Ctrl + D before selecting any label would result in an error.

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Fixed wrong Switcher Window on startup

We fixed an issue where the switcher window always appeared after installing the Enterprise edition over the Cloud edition.

The problem occurred because of the client.conf file was not updating the LastRunningEdition field when certain configurations were empty.

Now, the last used workspace is correctly remembered, and the switcher window only appears when needed.

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Properly show private directory contents

Previously, selecting a private directory in the pending changes view, caused two issues:

* The directory contents were not displayed in the Content Viewer.

* An empty side panel remained visible on the left.

Both issues are now resolved.

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: TextEditor find popup didn't process keyboard shortcuts properly

Shortcuts like Cut, Paste, Select All, and others were intercepted by the diff view instead of the “Find…” popup. Now, the keyboard commands behave correctly when the “Find…” text field is focused. It also fixes tab navigation to move focus as expected.

#### Windows - PlasticFS

Windows - PlasticFS: The installer does not honor the PlasticFS configuration on restart

When upgrading to a different version of Unity VCS while using PlasticFS, you are asked to stop the PlasticFS tray application. So far, the installer did restart PlasticFS at the end, but it didn't do it ignoring any special configuration.

Now it will honor the settings that you set in your plasticfs.conf file.

***

## 11.0.16.9143

> **Note:**
>
> **Public** | 2025-01-30

### Bug

#### All platforms - Server

All platforms - Server: Prevent moving a repository inside itself

Previously when you moved a repository under itself (MyProject/MyRep -> MyProject/MyRep/tests) fails with the error "Module can't be created because parent repository doesn't exist." and the repository ends up unreachable.

Now when you try to move a repository under itself the operation fails with a meaningful error "The repository 'MyProject/MyRep' cannot be moved inside itself 'MyProject/MyRep/tests'." and the repository remains with its old name.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Focus set to the Search filter text box

When adding users to code reviews through the "Select user or group" dialog, the focus is now automatically placed in the Search filter text box.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Ignore.conf is reformatted after adding a new file via the GUI

Fixed an issue where adding new rules caused the `ignore.conf`, `cloaked.conf`, or `hidden_changes.conf` files to be reformatted, which could result in the loss of comments.

Now, comments are retained when updating `ignore.conf`, `cloaked.conf`, and `hidden_changes.conf`.

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Prevent duplicate key error in Pending Changes

We've fixed an issue where enabling the Tree View mode in the Pending Changes view could cause a "same key already added" error when trying to check-in the files for nested folders.

***

## 11.0.16.9132

> **Note:**
>
> **Public** | 2025-01-23

### New

#### All platforms - Gluon

All platforms - Gluon: Folder History Feature Added

We've introduced the ability to view the history of folders in Gluon. This enhancement makes it easier to track changes, access previous versions, and stay informed about updates within directories.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/a1669667f978a24b96a790252891a19d4b5397c255df675d599367b256091215.png)

#### Command-line client

Command-line client: New variables in check-in triggers

Added new environment variables to the check-in triggers:

* `PLASTIC_REPOSITORY_NAME`: The repository name where the check-in is run.

* `PLASTIC_BRANCH_NAME`: The name of the check-in target branch.

* `PLASTIC_FULL_BRANCH_NAME`: The full name of the check-in target branch.

These variables have been added to all check-in triggers (client & server and before & after). It means: before-clientcheckin, after-clientcheckin, before-checkin and after-checkin.

These variables can be used to easily get the target branch for the current check-in operation inside the trigger code.

Example:

```console
PLASTIC_REPOSITORY_NAME=myrepo
PLASTIC_BRANCH_NAME=task001
PLASTIC_FULL_BRANCH_NAME=/main/release/task001
```

### Bug

#### Server - All platforms

Server - All platforms: Fixed login regression when using Active Directory

We fixed an issue introduced back in release 11.0.16.8845 where user login attempts would fail with an "Invalid Credentials" error in certain configurations.

This happened when the server administrator configured the User Display Name Attribute setting in LDAPWorkingMode when working against an Active Directory server.

The system now correctly calculates user details (DN) regardless of this setting, ensuring a correct authentication.

***

## 11.0.16.9116

> **Note:**
>
> **Public** | 2025-01-16

### New

#### All Platforms

All Platforms: Introducing Branch Hiding!

We're excited to announce a long-awaited feature: the ability to hide branches! This new capability lets you focus on what's important by removing unwanted branches from your views.

\== How it works? ==

Hiding branches happens at the server level, meaning once a branch is hidden, it disappears from the Branch Explorer, Branches View, and even the Changesets View for all users of the repository. However, the branch and its content still exist in the repository, so you can unhide or use it whenever needed.

\== Who can hide or unhide branches? ==

Any user with "change" permission on a specific branch can hide or unhide it. This ensures flexibility while maintaining appropriate access control.

\== When to use Branch Hiding? ==

Sometimes, you may ask us to delete branches, but this isn't always possible — e.g., when a branch has been integrated. In these cases, the Desktop GUI will now offer the option to hide those branches instead, helping you keep your workspace organized without permanently removing data.

\== A note on visibility ==

While hiding a branch removes it from immediate views, the branch and its content remain intact in the repository. This ensures that no data is lost, and you can retrieve or unhide the branch at any time.

You can hide or unhide branches using either the command line or the Desktop GUI:

\== Command Line: How to use Branch Hiding? ==

Use the following commands to hide or unhide branches. For additional details, include the --help option.

```text
cm branch hide /main/task001 /main/task002
```

```text
cm branch unhide /main/task001 /main/task002
```

\== Desktop GUI: How to use Branch Hiding? ==

A simple and intuitive way to hide/unhide branches is also available directly within the GUI.

From the Branch Explorer or Branches View, there's a new option available to Hide a branch:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/d45d6a0d799fde9d39d9077e3f9eb79710a4774db11104adf9be86804f92e7d5.png)

Note you can use "Ctrl-H" as shortcut!

To see all the hidden branches, you can go to the Branches View and click on the new 'Show hidden branches' button:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/d6bc7fbecc54cbfdb26ab6d2cd5df3a7d4a1972a8a86b627cc738a60c7e15121.png)

If you use this feature together with display filters, the hidden branches take them into account, making it easier to find the right branch based on your search criteria:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/b3b5d48bdd216dbef25b6b1d40252948cbd77657265744562ecbcbb4cec9d93e.png)

When showing the hidden branches, there's a new option available to Unhide a branch.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/e8ee0492130f281785a65382d1da99e66578827383a52f09799513ab23f61d23.png)

We're confident this feature will make managing your repositories more streamlined and efficient. Try it out and enjoy a clutter-free experience in Plastic SCM!

#### Windows - Installer Update

Windows - Installer Update: Remove discontinued plugins

We're excited to share an important update! We've optimized the installer by removing discontinued plugins and upgrading older .NET Framework applications to .NET. This change has cut the installer size by more than half, making installation faster and more efficient.

\== What’s Changing? ==

We're discontinuing support for the following legacy Unity Version Control (UVCS) plugins:

* Visual Studio Integration

* Shell Extension

* SCC Plugin

* Microsoft Office Integration

\== Why are we making this change? ==

These plugins no longer align with our vision for delivering a streamlined, modern product. By focusing on core improvements, we'll deliver updates faster and enhance the overall user experience.

\== What should you do? ==

We strongly recommend upgrading to the latest version of UVCS to enjoy the latest improvements, performance boosts, and bug fixes.

If you rely on the discontinued plugins, you can keep using them by staying on your current UVCS version. However, please note:

* These plugins will no longer be maintained or supported.

* Compatibility or functionality issues may arise in the future.

Thank you for your understanding and for being part of our journey to improve Unity Version Control. If you have any questions or concerns, feel free to reach out to our support team—we're here to help!

#### All platforms

All platforms: GitSync handles the .lfsconfig URL setting

GitSync now takes into account the .lfsconfig configuration file. It looks for the URL setting in order to use the specified URL for the LFS blobs download/upload (instead of always using the default one).

This allows you to import repositories from Git (to UVCS) that used a custom URL for the LFS blobs though the .lfsconfig file.

It only accepts HTTP/HTTPS URLs at the moment:

```console
[lfs]
url = https://github.company.com/ruben/lfs-storage.git/info/lfs
```

### Bug

#### All clients

All clients: Fixed "Unable to cast object" error checking in a file under an Xlink

This error only happened under very specific circumstances:

* You have a file checked-out under an Xlink with a fs protection set from Linux/macOS.

* There are new changes only in the root repo, so you need to run an Incoming Changes operation before running the check-in.

* After that, the check-in operation throws the error: Unable to cast object of type 'Codice.CM.Common.Tree.CheckinItemData' to type 'Codice.Client.Commands.CheckIn.ClientCheckinItemData'.

Now it's fixed.

#### All platforms - Gluon

All platforms - Gluon: File conflicts not properly detected applying a shelveset

The Gluon shelveset application didn't promote the changes to file conflicts when the file was not modified in the workspace and the workspace revision didn't match with the base revision of the change. This way, it applied directly the shelveset change content to the workspace, losing all the changes introduced later in the file.

Now, it properly detects the file conflict and merges the workspace changes with the shelve changes.

***

## 11.0.16.9080

> **Note:**
>
> **Public** | 2024-12-12

### Bug

#### All platforms - Command line client

All platforms - Command line client: Fix checkconnection failing for `@unity` orgs

Fix `cm checkconnection <repserverspec>`  when used with a `@unity` organization.

#### All platforms - Gluon

All platforms - Gluon: Failed to checkin an applied shelve

The check-in operation failed when it was run after applying a shelve that contained a changed file in a Gluon workspace. This happened when the check-in was tried from the GUI or when specifying the paths to checkin from the command line. Now it's fixed.

#### All platforms - Desktop GUI/Gluon

All platforms - Desktop GUI/Gluon: Incoming changes notification panel wrongly updated

Switching between workspaces could lead to have the incoming changes notification of a workspace displayed into another workspace. Also, that we were checking for incoming changes for more than a workspace at the same time, wasting resources unnecessarily.

Now we ensure updates reflect the current workspace only, preventing incorrect data display after switching workspaces. Also that the current workspace is the only one checked.

***

## 11.0.16.9069

> **Note:**
>
> **Public** | 2024-12-03

### Bug

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Improve progress for directory conflicts resolution.

The Merge & Incoming Changes views need to handle directory conflicts in some scenarios. The progress of the directory conflicts resolution was not properly updated with multiple selection plus the "Apply this action for next X conflicts" option enabled.

Moreover, the "Resolve directory conflict" button was not disabled during the directly conflicts resolution. So, if the button was clicked, it launched more concurrent conflicts resolutions for nothing.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/bc1eeb8cca231cdf78650b2ee99128113547a28b9a6b1b7618c099229d830091.png)

Now, the button is disabled and the progress properly updated during the directory conflicts resolution.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/5aa08523429672ba381891f2118e22c99de7d6c291159870fd19f08bce400a86.png)

***

## 11.0.16.9055

> **Note:**
>
> **Public** | 2024-11-28

### New

#### All platforms - Command line client

All platforms - Command line client: checkconnection can now check a specific server.

cm checkconnection learned a new optional argument `<repserverspec>` that is used to check the connection against a specified server instead of using the default one configured in the client.conf file.

### Bug

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Fixed background color for dark theme in code review view

In last release we introduced a bug where the code review view in dark theme showed the comment text boxes in a light background color. We fixed this issue, and now the background color matches the selected theme.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/71cd4195d50128054011683731133e2b283069e76f47d82d7392af527efbfce3.png)

***

## 11.0.16.9039

> **Note:**
>
> **Public** | 2024-11-21

### New

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Code Review Email notifications

Implemented several functionalities to enhance email notifications in the Desktop GUI.

Users can now subscribe or unsubscribe using a dedicated button, with a status text indicating their subscription state.

Additionally, email address autocompletion with profile pictures has been added for user convenience when typing `@`.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/0bea3e42d9c45bc29a9016e060e58c23bbdd08487402d86f5cf3f70bc14b9608.gif)

#### All platforms - Desktop GUI/Gluon

All platforms - Desktop GUI/Gluon: Update Avalonia version to 11.1.5

We've upgraded to [Avalonia 11.1.5](https://github.com/AvaloniaUI/Avalonia/releases/tag/11.1.5) for improved performance and stability. Additionally, AvaloniaEdit and AvaloniaEdit.TextMate have been updated to the latest versions. TextMateSharp is now at [version 1.0.63](https://github.com/danipen/TextMateSharp/releases/tag/v1.0.63). These updates ensure better functionality and a smoother user experience.

***

## 11.0.16.9009

> **Note:**
>
> **Public** | 2024-11-07

### New

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Added version in the title bar

We have included the Plastic version in the title bar for both UVCS and Gluon windows. This enhancement simplifies version identification for users and especially for the support teams when they receive screenshots from customers.

#### All platforms - Command line client

All platforms - Command line client: Now you can see the internal seid from `cm li`!

The `cm li` command is able to print the raw user seid with the `--printseid` option. It can also sort the list of users by seid specifying the `--sort=seid` option.

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Update branch icon orientation

The branch icon has been updated from a vertical to a horizontal orientation. This change is intended to improve visual clarity and align with user expectations through all our applications.

### Bug

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Pending Changes not displaying changes

The Pending Changes view did not update correctly after checking in or undoing all filtered changes, and clearing the filter required a manual refresh to display the remaining changes. This issue has now been resolved, ensuring that all changes are displayed automatically after the filter is cleared.

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Fixed a memory leak in the Branch Explorer view

Fixed high memory usage when switching workspaces and loading large branch explorers with date filters set far back. Ensured memory is properly freed after switching workspaces.

Additionally, improved performance for calculating the layout in large Branch Explorers datasets, now making it approximately 30 times faster.

***

## 11.0.16.8988

> **Note:**
>
> **Public** | 2024-10-30

### New

#### All platforms - In order to see the applied attri…

All platforms - In order to see the applied attributes of a specific branch or changeset, you now only require the 'read' permission

Previously, a user needed the whole 'applyattr' permission, in order to see the applied attribute of an object (branch, change...).

Now, when users only need to view the object, they only need the 'read' permission granted on the attribute.

You can set the 'read' permission either using the GUI or the 'cm acl' command.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/8074c9170cdb185ada819b7512267221e47a4e073de574d043920150ab6adc44.png)

### Bug

#### Windows - Installer

Windows - Installer: Cannot run installer on some windows machines.

When running the installer (no matter which flavor) on some Windows 10 & 11 machines, weird errors appeared, with messages such as "Unkown tag", "Could not create namespace 'substitution'", and many more.

We fixed this problem by building the installers in Windows-x64 mode only, and upgrading to the latest version of our install builder provider.

#### Polarion

Polarion: Server-side Polarion integration not loaded

The server-side Polarion integration was throwing an error while trying to configure a Plastic SCM repository.

Now it is fixed, and you can configure it as documented [here](https://docs.plasticscm.com/extensions/plastic-scm-version-control-task-and-issue-tracking-guide#Polarionintegration)

Remember the server-side polarion integration relies on the `cm.exe` command line client: Make sure the command client is configured to work with a valid server and credentials,

and the service account the Polarion server uses to run the service is able to access to the `client.conf` configuration file.

The best option is to configure the client by using the `plastic` GUI application or `cm configure` command, and then, copy the `client.conf` file from `%LocalAppData%\plastic4` to `PLASTIC_INSTALL_DIR\client`.

***

## 11.0.16.8976

> **Note:**
>
> **Public** | 2024-10-24

### New

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Support for opening file links

Desktop GUI now supports opening file links directly. There are three types of links:

* File link: Focuses the specified file in the GUI, creating the workspace if it doesn't exist.

* File link on branch: Switches to the specified branch, and focuses the specified file in the GUI, creating the workspace if it doesn't exist.

* File link on changeset: Switches to the specified changeset, and focuses the specified file in the GUI, creating the workspace if it doesn't exist.

Users can now copy this kind of links from the Items view in the Desktop GUI from the context menu "Copy > Copy link", "Copy > Copy link (current branch)", or "Copy > Copy link (current changeset)."


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/55d4f86fd0870aba4287af19f796063907c258384c30dad7b20727c72be40784.png)

### Bug

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Fixed error when opening some Code Reviews

Fixed an issue that caused an error when opening code review comments in the desktop client. This error occurred because some comments had incorrect location information. Now, the system will skip problematic comments and handle empty or incorrect location details better, preventing the error from happening.

#### All platforms - GUI

All platforms - GUI: Fixed an error when contacting a Cloud org. from On-Prem for the first time

When logging in for the first time against a Cloud organization (for example, when adding a destination on a sync view), the GUI could throw a "Failed to resolve the cloud server for organization" error. This is now fixed.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Merge not working using a renamed repository

Using a workspace pointing to a renamed repository, the merge failed with the error `new_repository_name@cloud is not in a workspace`. Now it's fixed

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Fixed view switching shortcuts

Attempting to press `Ctrl/Cmd + <number>` from the home view or login screen caused an unexpected error due to the Workspace view not being created yet. This issue has now been resolved.

Additionally, new shortcuts for displaying the Workspaces and Repositories views have been added:

* Shift+Ctrl+1 for Repositories view (Windows and Linux)

* Shift+Ctrl+2 for Workspaces view (Windows and Linux)

* Shift+Cmd+1 for Repositories view (macOS)

* Shift+Cmd+2 for Workspaces view (macOS)

***

## 11.0.16.8953

> **Note:**
>
> **Public** | 2024-10-17

### New

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Deeplink of UVCS repositories

A new plastic link format has been introduced to open repositories hosted in Unity Version Control (Plastic).

Links like the following ones can now open the specified repository in the full client of Unity Version Control (Plastic) or its artist-friendly Gluon applications:

```text
plastic://codice.cloud/repos/codice
plastic://codice.cloud/repos/codice?ui=gluon
```

If a workspace pointing to that repository is missing, a "create workspace" dialog will appears with pre-filled fields, allowing users to quickly set up and download the workspace.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/667b8e9ba08c73990ff904f0bda8fbb620c86d171ce71e723327160950c275e8.gif)

Note that you can choose the tool (full Unity Version Control client (Plastic) or Gluon) by adding `?ui=gluon` to the link. Existing diff and file links continue to function as before.

### Bug

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Null exception when showing annotate from code review window

There was an exception when trying to show the annotate for a file from a code review window, when the code review was opened from a plastic link. In this scenario, there is no current workspace, and trying to access it was causing an error. We fixed it, and now you can see the annotate normally

#### All platforms

All platforms: GitSync doesn't push the .git folder anymore

GitSync doesn't push the .git folder (if it exists in the Unity VCS repo) to Git since some Git servers/providers could reject the push operation due to it.

#### All platforms

All platforms: Creating an attribute via API no longer fails if triggers are set

We detected that creating attributes using the REST API endpoint failed if the `before-mkatt` or `after-mkatt` triggers were set. We fixed that issue, so it shouldn't happen anymore.

#### All platforms - CLI

All platforms - CLI: Purge author could not unregister it

The author could not unregister the purge. The 'cm purge unregister' failed with the error 'You are not the purge author. Only the purge author is allowed to execute or unregister it.' (even when the user is the author). Now it's working.

***

## 11.0.16.8933

> **Note:**
>
> **Public** | 2024-10-10

### New

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Improve Filtering in Code Reviews

Based on user feedback, we've enhanced the Code Review feature with better filtering and usability. A new "Reviewer's status" filter lets you filter reviews by the reviewer's status. When combined with the Reviewers filter, this allows for more accurate identification of reviews needing your attention.

We've also improved the tooltips to clearly display each reviewer's status.

Additionally, the comments tooltip now shows the count of comments and unresolved issues for added clarity.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/2eb35f2cefda82e8a9cd4a999bb7542cb295b6bd44f36731ab691f0a29e9d4dd.gif)

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Make the default changelist always visible

Ensure that the default changelist remains visible even when empty in the GUI clients. This option helps users locate the default changelist for easier drag-and-drop operations between default and custom changelists.

### Bug

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Diff View intraline diff misalignment

The diff view in the Desktop GUI showed the highlighted code on the left side (for deleted content) skewed to the left. This misalignment was due to improper handling of tabs as indentation. Now it's fixed.

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Cmd+A/Ctrl+A not always selecting all pending changes

Cmd+A/Ctrl+A failed to select all pending changes if an item started with "A". This has been fixed by handling the KeyDown event to properly process the SelectAllRows command, ensuring that all changes are highlighted as expected.

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Drag and Drop error between changelists

Fixed an issue that caused an error when dragging files to custom changelists while the "Group changes by categories" option was disabled.

The problem was due to improper setting of the changes parent, which has now been corrected.

***

## 11.0.16.8906

> **Note:**
>
> **Public** | 2024-10-03

### New

#### All Platforms - Support for renamed repositories…

All Platforms - Support for renamed repositories on existing workspaces

Previously, when a repository was renamed, the workspaces pointing to the repository prior to the renaming stopped working. This happens because they kept using the old name, and the server can no longer find a repository named like that.

Now, workspaces can continue using the old repository name, even after the repository is renamed. The server will keep track of the old name for you after renaming a repository, so you don't need to change anything. Note however that this won't remain valid if the old name is claimed by another repository (i.e., if you rename an existing repository or if you create a new one named like that). In that case, the workspace would automatically connect to a different repository, forcing you to switch.

> **Note:**
>
> The Desktop GUI home view will not list workspaces linked to an old repository name. However, you can still find these workspaces in the dedicated workspace view.

> **Note:**
>
> There is a limitation that prevents doing client-side merges using the GUI on these workspaces. For now, you can use the command-line client (cm) or use the server-side (aka "merge to") option within the GUI. We will remove this limitation in the next release.

### Bug

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Wrong changeset selection in the diff window

When quickly moving through code-review changesets, users might review changes from the wrong changeset due to a concurrency issue. The earlier diff process wasn't properly stopped, causing old changes to display instead of the selected changeset. This issue is now resolved by ignoring outdated diffs when calculating differences for a newly selected changeset.

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Use the right dir separator char when copy path

Fixed an issue in Windows where the relative path copied to the clipboard was incorrect. The path now uses the appropriate directory separator character for Windows, and the leading slash is removed.

This fix ensures the workspace relative path preserves the right directory structure across all views, including DiffTreeView, Items view, and Merge view in Plastic, as well as CheckinView, Incoming Changes view, and Workspace explorer in Gluon.

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Drag & Drop error in Tree Mode

Fixed an issue with the new Drag & Drop feature between changelists. When using the Pending Changes view in tree mode, selecting a combination of files and directories caused an error message: "An error occurred processing your request."

This has been fixed by skipping structure nodes during the drag-drop operation.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Disabled "Create" button when creating a new repository

We fixed an issue that was introduced in the previous release, where the "Create" button in the "Create a new repository" dialog was permanently disabled when opened in the "All workspaces" panel.

Now the button is only disabled when the dialog is loading, and enabled the rest of the time.

***

## 11.0.16.8888

> **Note:**
>
> **Public** | 2024-09-30

### New

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Add History and Annotate options

We have added "History" and "Annotate" options to the context menus of the Diff/Code Review and Merge views. These new features will allow users to view file history without leaving the current window.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/bcdd742613ff99f9a79e5119d79ee426b1c07b0665ac6aab41c50d4b4c0ab99f.png)

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Add Copy File Path options

We have added "Copy file path" and "Copy relative file path" options to various context menus in both the Plastic and Gluon GUIs, including Items/Workspace Explorer, Pending Changes/Checkin Changes, Merge View/Incoming Changes and Diff/Code Review views.  These new options will allow users to easily copy the path or the relative path of files, which could be needed in some scenarios.

* "Copy path" copies the full file or folder path to the clipboard.

* "Copy relative path" copies the file or folder path relative to the workspace to the clipboard.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/2fce01c2b7f254e671ba6b65d60fe2f4391353f3b1d0f2f4032cdb14b82bebcb.png)

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Drag & Drop files between changelists

Implemented Drag & Drop support for files within the 'Pending Changes' view when the option "Group changes in change lists" is enabled. Users can now easily move files between changelists, enhancing the workflow and improving ease of use.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/63f187e41ad363197c161bf7ea5dde49e423bbeeb13723be52764e36c7451cb6.gif)

#### All Platforms - Gluon

All Platforms - Gluon: Improved Switch Experience

On September 5th, in version [11.0.16.8845](https://www.plasticscm.com/download/releasenotes/11.0.16.8845#11.0.16.8845-new-1), we introduced the new Shelve & Switch feature in the UVCS GUI, which allowed users to easily switch with pending changes.

This feature is now also available for Gluon, so you can switch between branches and changesets in partial workspaces without effort!

### Bug

#### All platforms - Client and plugins

All platforms - Client and plugins: We fixed a problem where the client couldn't automatically renew user credentials when using Unity ID with a Cloud organization.

In some situations, client applications can use a token from one Cloud organization (A) with another Cloud organization (B). This let you access all your Cloud organizations with just one login, without needing to log into each one separately.

However, sometimes the client didn't update all the tokens correctly when renewing credentials. For example, it might update the token for organization B but not for organization A, which could lead to errors like: "Can't obtain a new token (Message: Invalid Refresh Token., Code: 132.104)."

This issue has now been resolved.

```console
== WARNING ABOUT THIS VERSION ==
```

Two minor issues have been identified in this version. They will be addressed in the next release.

1. The "Create" button in the "Create a new repository" dialog is permanently disabled when opened in the "All workspaces" panel. As a workaround to create new repositories, simply switch to the sibling "Repositories and workspaces" panel using the button at the top left corner of the GUI:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/1e4ffe9679b4c824850913bc3a3b8028585ee20d307e3f472def243679d61e12.png)

2. When the Pending Changes view is in tree mode and the new Drag & Drop feature is used between changelists, selecting a combination of files and structural directories will show an error message stating that "An error occurred processing your request".

***

## 11.0.16.8860

> **Note:**
>
> **Public** | 2024-09-12

### New

#### All Platforms - Desktop GUI/Gluon

All Platforms - Desktop GUI/Gluon: Improve keyboard usage

Shortcuts have been added for each view (Ctrl+1/Cmd+1 for Workspace Explorer, Ctrl+2/Cmd+2 for Pending Changes, etc ...). Tooltips have also been implemented to help discover shortcuts.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/323b10a6149f1ff27bfe51f209cc33d2fa7e0e5a0624a631d555c416e61dbb87.png)

When a view is selected, now the focus will now shift to the right pane for smoother keyboard navigation.

Additionally, we fixed a bug when pressing Ctrl+F (Cmd+F on macOS) focused on the search textbox but wrongly displayed an "f" character. Now it's fixed.

### Bug

#### All platforms - Desktop GUI/Gluon

All platforms - Desktop GUI/Gluon: The Branch Explorer date filter does not load in some corner cases

Setting some specific values in the date filter made it impossible to load on restart, leaving such filter in blank. The bug was fixed, and the new version can load the filter transparently.

***

## 11.0.16.8845

> **Note:**
>
> **Public** | 2024-09-05

### New

#### All platforms - Command-line client, Desktop GUI

All platforms - Command-line client, Desktop GUI: Improved Switch Experience with Pending Changes

Now you can seamlessly bring your pending changes with you when switching workspace configurations, both in the command line and in the Desktop GUI.

When using the Desktop GUI, a prompt will help you to enable this feature. You can also enable it within the Desktop GUI preferences dialog:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/03bd880d6f9eab541447f44d595185602dbb369ac2957a46fb461cb2a60fbcb2.png)

And also, by setting the following key and value in your `client.conf` configuration file:

```text
<PendingChangesOnSwitchAction>Shelve</PendingChangesOnSwitchAction>
```

Bringing your changes works as follows: when switching your workspace configuration by either using the Desktop GUI or the `cm switch` and `cm partial switch` commands, your client will look for pending changes in your workspace. If it finds any, it will ask you what you want to do, and it will present you three options:

* To shelve your pending changes and leave them on the source for future use.

* To bring the changes with you, moving them seamlessly to the destination branch.

* To cancel the operation.

If you choose to shelve your pending changes and leave them on the source, the client will create a shelveset with the changes, then switch your workspace configuration. You can apply the shelveset later on, whenever you want to. If you are using the Desktop GUI, the notifications it provides will indicate you that there are shelved changes and guide you through each step to apply them back, making the process smoother and more intuitive.

If you choose to bring your pending changes, the client will create a shelveset with the changes, then switch your workspace configuration, and finally will try to automatically apply the shelveset, effectively bringing your pending changes with you. If merge conflicts arise, you can choose whether to resolve them or to cancel the operation. Don't worry! If you cannot apply the shelveset, it won't be deleted either, so you can still apply it later on.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/4ab91900ebb37dba12e09e84836a91554e579e8fe62bbff045c7551e0aa510e7.gif)

Because of output compatibility, this new behavior gets disabled in the command line when using flags such as `--machinereadable` and `--xml`. If any of those flags are present, and PendingChangesOnSwitchAction is set to Shelve, the client will temporarily change the configuration value from Shelve to Fail, and you won't be able to change your workspace configuration with pending changes on your workspace. Bear in mind this if you have automated anything on top of the cm command-line client!

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Rename sync view's 'delete src/dst repo' buttons

Some users reported that the 'delete src/dst repo' buttons in the Sync Repositories view were confusing, as they thought it would delete the entire repository instead of just removing it from the sync view. To address this, the button was renamed to 'remove src/dst repo', and additional tooltips were added to clarify the action performed by the buttons.

### Bug

#### Command-line client

Command-line client: Unhandled exception when creating an Xlink outside a workspace directory

Creating an Xlink outside a workspace directory triggered an unhandled exception, printing an unhelpful error message.

```console
> cd .. # exit the workspace directory
> cm xlink -w my_xlink / br:/main@my_repository
Error: Object reference not set to an instance of an object.
```

Now, the error is handled, and a more apt error message is shown instead:

```console
> cm xlink -w my_xlink / br:/main@my_repository
c:\(...)\my_xlink is not in a workspace.
```

#### All platforms - Command line client

All platforms - Command line client: Authentication parameters work again wihout a valid client.conf file in place

Back in version 11.0.16.8782, we broke the possibility of authenticating against a given server using command-line authentication parameters without a valid client.conf file in place. This is now fixed: parameters such as `--username` and `--password` work again when the client is not correctly configured:

```text
cm repo list --username=sergio --password="t0p_secret!" --workingmode=LDAPWorkingMode --server="my-organization@cloud"
```

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Expanded/collapsed branches info was lost

When the Branches view was in Tree View mode, performing certain operations caused all child branches to auto-expand, ignoring the user's setup. Now it's fixed.

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: UI hangs with big minified files

The application previously froze in the pending changes/Diff view when handling minified files (JSON/JavaScript). Now it's fixed. Users can now display and edit these files without causing the UI to hang.

#### All platforms - Gluon

All platforms - Gluon: Fixed external tool option

When having a custom external tool defined in externaltools.conf, you may define @object as an argument to pass to the tool, and it will be replaced with the path of the selected object.

On Gluon, this path was relative to the workspace, so the custom tool couldn't process the file.

We fixed this behavior to use the absolute path, and now the tool can read the file as expected

***

## 11.0.16.8798

> **Note:**
>
> **Public** | 2024-08-08

### New

#### All platforms - Gluon

All platforms - Gluon: configuration now handles the "full update" mode

After the workspace undergoes a full configuration, it enters a "full update" mode. In this mode, every new item will be downloaded without relying on the granular directory configuration.

Previously, the configuration did not handle the "full update" mode correctly. It failed to properly display the new items as items to load and did not download them. This issue has been fixed.

### Bug

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Outdated branches displayed when no connection

When switching to a workspace with no connection, the branches popup displayed outdated branches from the previous workspace. Now it's fixed, and a proper panel displaying the error is shown instead.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/abbf7865d9f3871fd44405a54f5075561034ab122d79020131631536d3ee2606.png)

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Syntax Highlight highlighted non-code files

When switching between different file types in the Content View (Diff viewer's single file viewer), the syntax highlight sometimes didn't update correctly. This caused non-code files to retain syntax highlighting from previously viewed code files, leading to confusion. Now it's fixed.

***

## 11.0.16.8786

> **Note:**
>
> **Public** | 2024-08-01

### New

#### All platforms - Installer

All platforms - Installer: Fresh OnPrem install now enables ssl channel by default

Now the ssl channel is enabled on Plastic SCM server on OnPrem new/fresh installations.

This way, users are able to use this secure channel, or configure their mergebot profiles out-of-the-box without requiring extra admin intervention.

### Bug

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Incorrect Encoding in diff view for big files

When displaying "big files" differences, and the default encoding in the merge and diff preferences is set to "Windows-1252" or "Western Windows," the diff view incorrectly formatted the files using the wrong encoding. Now it's fixed.

***

## 11.0.16.8752

> **Note:**
>
> **Public** | 2024-07-10

### New

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Added comments and questions columns to code reviews view

We added two new columns to the code reviews view: the comments column, that shows the number of comments and replies, and the questions column, that shows the number of unanswered questions and unresolved change requests.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/c3ddaa4e72ea9c597ea3343f1dcf00c4f38b78eebd47dd9c8f7671dcf5efb86e.png)

### Bug

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Code review comments navigation fixes

We found and fixed two different issues that happened when opening a code review and navigate to a comment for the first time.

1. Navigating to a comment that was added in the "entire branch diff" mode, but showing the code review in "changeset by changeset diff" mode:

```console
An error message "The item for this comment cannot be shown as it has been deleted" was shown. The error is not shown the second time you navigate to the comment.
```

2. Navigating to a commend that was added in a given changeset in the "changeset by changeset diff" mode, and showing the code review in "changeset by changeset diff" mode in a different changeset:

```console
The changeset was selected but the comment file was not selected. The second time the navigation works fine too.
```

Both issues have been fixed.

#### Command-line client

Command-line client: The cm fast-import command failed when importing files bigger than 2GB

The cm fast-import command failed if the export file contained a blob bigger than 2GB. This happened because the blobs size was handled as an int32 value. Fixed.

#### Windows - Installer

Windows - Installer: Fixed error installing on-prem edition over an existing cloud edition

An error window at the end of the install process was shown when installing on-prem edition over an existing cloud edition.

The error was shown when the installer ran `plasticd upgradeconf` command (this command is just for upgrading the config files if you're upgrading from a plastic version from 2021).

***

## 11.0.16.8729

> **Note:**
>
> **Public** | 2024-06-27

### New

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Allow to remove branches with changesets

Before, if you wanted to delete a branch containing changesets, you had to delete the changesets first. Now all the data is deleted at once from the delete branch option.

Bear in mind that the operation is atomic. Either all of the changesets or none of them will be removed.

Plastic SCM will prevent removing the changesets in a branch under the following circumstances:

* The changeset zero is included in the operation (that is, you are trying to delete the main branch).

* One or more of the changesets have children outside of the branch (that is, the branch has child branches).

* One or more of the changesets in the branch are the source of a merge, and the destination changeset of the merge falls outside of the branch.

* One or more of the changesets in the branch are pointed to by a label.

* There are one or more shelvesets created from a changeset in the branch.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/9ddcd8f2dd003359c797df1657f7dbaf815075c0ad2de0e9ccae820db4a43220.png)

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Added advanced filters to the shelves view

The advanced filters that we are adding to several places in the GUI are now available in the shelves view. You can filter the shelves list by branch or user, using the same saved filters that you have for the rest of the views.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/1a168cb239101d55aa91327eaa33faae80725522d1a8d7e615a3ec4193059894.png)

#### All platforms - Semanticmerge

All platforms - Semanticmerge: Updated semanticmerge to support C# 12

We updated the parser in semanticmerge to support the new features in C# 11 and C# 12. The syntax highlighting now also supports these new versions.

Also, when semanticmerge detects parsing errors, they are now shown automatically in a modal dialog, warning about possible file corruption if the user continues.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/c29de20604531cc4b6df6578ed3601c313af19fd26964cf8e8b7e14df667942a.png)

### Bug

#### All Platforms - Server

All Platforms - Server: Changeset deletion can fail in partially replicated repositories

The changeset deletion of a replicated changeset failed if its parent was not replicated too. The error thrown was "Cannot show differences between changeset X and changeset Y. The source changeset X has not been replicated to this repository. Make sure that you replicated the branch containing this changeset".

Now, the changeset deletion succeeds regardless of whether the parent changeset was replicated or not.

#### All platforms - Desktop GUI, Gluon

All platforms - Desktop GUI, Gluon: Allow to specify multiple repositories in the advanced queries

For some of the query views, like the Branches or Code Reviews, if you used an advanced query that contained multiple repositories, an error was raised to the user. We fixed this error, and now you can specify multiple repositories in the query, and use it together with the new filters.

#### macOS - Desktop GUI

macOS - Desktop GUI: Crash when canceling undo changes dialog

The application crashed when the "Undo confirmation" dialog was closed by pressing the "Esc" key in the pending changes view.

Additionally, a fix was applied to prevent the TreeDataGrid component from incorrectly moving the selected item when Esc was pressed.

#### macOS - Desktop GUI

macOS - Desktop GUI: Fixed writing issue in merge-to dialog

When performing a server-side merge operation, the dialog that lets you write the checkin comment was not working properly on macOS, resulting in unexpected behavior after removing characters and writing them again. This issue is fixed, and now you can use the text area normally.

***

## 11.0.16.8673

> **Note:**
>
> **Public** | 2024-06-05

### New

#### All Platforms - Gluon/Desktop GUI

All Platforms - Gluon/Desktop GUI: New Workspaces View added to the home view

A workspace view option has been added to the home screen, providing an easier way to manage multiple workspaces. This is useful when a user belongs to several organizations or uses different servers. This new view includes the ability to:

* Filter existing workspaces.

* Interact with them (rename, delete, open, open in a new window, etc )

* Create new workspaces.

* "Reconnect" workspaces on disk that UVCS is not aware of. A new option has been created for this: "Add an existing workspace".


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/9604d8bac35f2033021c1c2c44c47d59a1251ec4adf139f39bfbd20641259d55.gif)

#### All Platforms - Gluon/Desktop GUI

All Platforms - Gluon/Desktop GUI: Improved Workspace Deletion Process

The process for deleting workspaces has been enhanced. Now, users can delete active workspaces (or repositories with active workspaces). Previously, workspaces that were opened (in the current window or a different window) couldn't be deleted. This change significantly reduces restrictions and improves overall usability.

#### macOS and Windows - Gluon/Desktop GUI

macOS and Windows - Gluon/Desktop GUI: Drag and Drop functionality for workspaces

A new drag-and-drop feature has been implemented in the workspace management system. This enables users to open or create workspaces (and reconnect existing workspaces), just by dragging a folder to the UVCS window, providing a faster and more intuitive user experience. The drag-and-drop feature is only available in macOS and Windows (the Linux platform is coming soon).


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/110109a9b212b3500e488a502dc23206bd3633bf2851082e0385e8cef34af909.gif)

### Bug

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Fixed error loading branch explorer for old servers

When using a modern client connected to an on-premises server with an old version (+2 years ago) there was an error shown when trying to load the branch explorer.

We fixed this issue and now you can see the branch explorer diagram without errors regardless of the server version

***

## 11.0.16.8664

> **Note:**
>
> **Public** | 2024-05-30

### New

#### All platforms - Desktop GUI, Gluon

All platforms - Desktop GUI, Gluon: New options button in the content viewer

We added a new options button when showing the content of added/deleted files. Similar to the one we already had for the diffs, you can change the syntax highlight, encoding or editor options from this new button.

Also now, the code editor settings already configured, are applied in this editor (view whitespaces,...). You already had the code editor settings available from the Preferences window.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/38a9d96f4f2eb3daab4c515595d6246e3722d4783928970be20d6f687c2cdd6b.png)

#### Linux - Command-line client

Linux - Command-line client: command line package size shrunk by 40%

The `plasticscm-client-core` [linux package](https://www.plasticscm.com/plastic-for-linux) has been reduced from 127MB to 72MB (more than 40%).

Some unnecessary assets were removed from the bundle, together with java-based plugins (you can still download them separately from "Plugins zip" installer in [https://www.plasticscm.com/download/](https://www.plasticscm.com/download/) page

#### Linux - Command-line client

Linux - Command-line client: Security issues addressed

Some vulnerabilities of `plasticscm-client-core` package were addressed, as there were some outdated third-party libraries bundled, such as `Newtonsoft.Json`. Either they were updated to safe versions or removed from the package.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Advanced filters for code reviews

We added a new set of filters in the code reviews view, similar to the ones in other views like the branch explorer. You will be able to use the same saved filters you had in the other views for the date and user filters.

In addition, you can also filter reviews by the assigned reviewer and by status.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/8ef8427152d773084514325c9cbd4ac8970b1d05cb29ea30640bf6d2f334935d.png)

#### Command-line client

Command-line client: New variables in Review triggers.

Added new variables to the triggers related to Reviews:

* `PLASTIC_REVIEW_REVIEWERS`: All the reviewers in format `user:status;user:status...`. For example:

  ```text
  john@company.com:Under review;karen@company.com:Rework required
  ```

* `PLASTIC_REVIEW_COMMENTS_COUNT`: Total number of comments.

* `PLASTIC_REVIEW_USER_COMMENTS_COUNT`: Total number of user-added comments.

* `PLASTIC_REVIEW_UNRESOLVED_CHANGES_COUNT`: Number of unresolved changes.

* `PLASTIC_REVIEW_UNANSWERED_QUESTIONS_COUNT`: Number of unanswered questions.

### Bug

#### Linux - Installers

Linux - Installers: Cannot resolve libicu dependency on Ubuntu 24.04. Fixed.

Some Debian / Ubuntu distros were showing an error while installing telling that there is an unmet dependency of `libicu` that cannot be resolved.

Now it is fixed, since `libicu74` is now set as a valid alias for `libicu` dependency.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Fixed locked workspace error when performing a merge

In some scenarios, when performing a merge operation and choosing to keep the changes on the destination, you could get an error saying that the workspace is locked due to the merge operation. We fixed this error so now you can perform the whole merge as usual

***

## 11.0.16.8622

> **Note:**
>
> **Public** | 2024-05-16

### New

#### All platforms - REST API

All platforms - REST API: Remove branches with changesets using the v2 REST API

Before, if you wanted to delete a branch, you had to manually delete its changesets first. Now you can delete all the data at once with the `deleteChangesets` query parameter:

```text
curl -X DELETE https://my-plasticscm-server:7178/api/v2/organizations/ORG_64_/repositories/Game2020/branches/1993?deleteChangesets=true \
-H "Authorization: Bearer $ACCESS_TOKEN"
```

Bear in mind that the operation is atomic. Either all of the changesets or none of them will be removed.

Plastic SCM will prevent removing the changesets in a branch under the following circumstances:

* The changeset zero is included in the operation (that is, you are trying to delete the main branch).

* One or more of the changesets have children outside of the branch (this is, the branch has child branches).

* One or more of the changesets in the branch are the source of a merge, and the destination changeset of the merge falls outside of the branch.

* One or more of the changesets in the branch are pointed to by a label.

* There are one or more shelvesets created from a changeset in the branch.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Added advanced filters to multiple views

We added the filters panel that we already have for the branch explorer to the branches, changesets, labels and attributes views.

You can now easily filter all views by date, branch and user using the same saved filters that you had in the branch explorer.

You can also still use a custom query if you want more advanced filtering.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/d00cd26cfb6a28974b1558feeb9f2c5ae22c6c27bb03166fb9d08bee9140df7e.png)


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/6fd869555d93dc9f1804e50ce01f7d367f1adc5b7abf6b6449a3d0537b09cae0.png)


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/843286fb15df04115e39ca1b7045e90777d8d587dcb81b0a96bdbd3588edbd93.png)


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/12920157d19f7b5078ff86a394478d42bb60429e6d446a231594f4e8cb6f4e1c.png)

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Keep the code reviews filter preference after restarts

When you select a filter in the code reviews view, this filter was lost after closing the application, and you had to re-apply it the next time.

We modified the behavior so now the filter is kept across restarts.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/1c221e1dfa300f8493784b7a32ba46c1579aaf0b55864c98672b393803c5c419.png)

#### All Platforms - Gluon

All Platforms - Gluon: Allow to share and open folder links

In Gluon, we've expanded the sharing functionality to include folders in addition to files. Previously, users could only copy links to files for sharing, but now they can also share links to directories. This enhancement improves collaboration by allowing users to easily share and open folder links with others.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/39014c05a565c28e4ef707b0297ca18b4bbb2c2059946619600bc74dbc4e6762.png)

#### Server

Server: SAML authentication is now enabled by default

Previously, the "SamlAuthenticationEnabled" feature flag had to be set in your server.conf in order to explicitly enable SAML authentication. Now the feature flag will be ignored. For more information on how to set up SAML authentication on your on-prem server, check the following technical documentation:

[/unity-version-control/uvcs-on-prem/saml-auth-microsoft](/unity-version-control/uvcs-on-prem/saml-auth-microsoft.md)

### Bug

#### All platforms - Desktop GUI, Gluon

All platforms - Desktop GUI, Gluon: Consistent behavior adding comments to binary files in code reviews

We've made sure that adding comments to binary files in code reviews behaves consistently, whether the files are added or changed. Previously, there was a discrepancy where comments could be added for added binary files in the metadata lines, but not for changed binary files. Now, both scenarios behave the same way - comments are not allowed. In the near future, we plan to enable adding comments to entire binary files at the file level.

***

## 11.0.16.8577

> **Note:**
>
> **Public** | 2024-04-25

### New

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Quick Branch Switching

We've introduced a game-changing feature: Quick Branch Switching. We've added a new menu at the top that lets you easily jump between main, recent, and other branches, without losing context.

Features:

* Branch popup: The top button now opens a menu with categories for main, recent, and other branches.

* Better Organization: Branches are sorted into three groups to make finding them easier.

* Filter: You can use a text filter to find branches quickly.

* Create a New Branch: You can now create new branches right from the popup.

Check out it here!


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/38b56d964dacced6f2a62a3f73fc8a39ce249a602283a92782e68ab9bb427436.gif)

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Enhance refactor groups

Analyze Refactors is a really powerful feature when reviewing the changes. The refactor groups were only calculated for the entire branch mode in the diff window. Now, they are also calculated when exploring the differences changeset by changeset. The next step will be to add them to the code review window too.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/460480f8f228f4a43c285d9574e49278a121e75edfcdf29fe91f814584589c54.png)

Apart from that, other quality improvements have been made when computing the differences. Before you could notice some "freezes" while loading them. They are fixed now too.

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Auto-refresh Code Reviews View

We've enhanced the Code Reviews view by implementing auto-refresh functionality. Now, whenever certain actions are performed on a code review, such as editing the title, creating, editing, replying to, or deleting a comment, modifying reviewers, changing reviewer status, or applying/discarding a comment, the Code Reviews view will automatically refresh.

#### Command-line client

Command-line client: Branch deletion

You can now remove branches with changesets using the `cm` command line.

Before, if you wanted to delete a branch with changesets, you first had to delete the changesets and then delete the branch. Now you can delete all the data at once with the `--delete-changesets` flag:

```text
> cm branch delete br:/main/scm1001540 --delete-changesets
```

Bear in mind that the operation is atomic. Either all of the changesets get removed or none of them will.

Plastic SCM will prevent removing the changesets in a branch under the following circumstances:

* The changeset zero is included in the operation (this is, you are trying to delete the main branch).

* One or more of the changesets have children outside of the branch (that is, the branch has child branches).

* One or more of the changesets in the branch are the source of a merge, and the destination changeset of the merge falls outside of the branch.

* One or more of the changesets in the branch are pointed to by a label.

* There are one or more shelvesets created from a changeset in the branch.

#### Command-line client

Command-line client: Branches can be specified by guid

We added a new branch spec that allows to use the branch guid to refer to a specific branch through the command line.

Examples:

```text
cm switch br:brguid:68846cdd-6a46-458c-a47f-52454cc150d9@plastic@skull:9095
cm find branch "where parent='brguid:68846cdd-6a46-458c-a47f-52454cc150d9'"
```

More info can be found in the 'cm objectspec' command.

#### Windows - Wwise plugin

Windows - Wwise plugin: Plugin upgraded to SDK 2023

The Wwise plugin was upgraded to use the latest version of the Wwise SDK (2023.1.3.8471). This new version will allow users to continue using our version control integration in Wwise 2023. You can find the new plugin under the installation path "client/plugins/wwise/PlasticSCMWwisePlugin2023.dll".

Please refer to our documentation about the plugins for more information ([/unity-version-control/vcs-plugins/wwise-plugin](/unity-version-control/vcs-plugins/wwise-plugin.md)).

***

## 11.0.16.8564

> **Note:**
>
> **Public** | 2024-04-18

### New

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Improved history view filters

The history view has a filter that allows you to see only the revisions that belong to the specified branches.

In addition to this, we added a user filter that lets you specify the author of the revision.

These filters now have the same design as the ones in the branch explorer view.

On top of that, both views share the saved filters list, so you can create one filter from the branch explorer and use it from the history view.

#### All clients

All clients: Removed transformable workspaces support

Transformable workspaces support was added long time ago. However, they were actually never used or fully supported by the system (i.e. not supported by Partial workspaces or Incoming Changes operations). The feature was removed from the system.

#### Windows - Wwise plugin

Windows - Wwise plugin: Plugins moved under a common folder

From this release on, all versions of the Wwise plugin are moved under a common installation folder "client/plugins/wwise".

### Bug

#### All Platforms - Server

All Platforms - Server: 'Collection was modified' error using LDAP

The Novell.Directory.Ldap version that the server used (3.4.0) had a bug related to a collection that was not thread safe. This issue was fixed in the version 3.6.0: [https://github.com/dsbenghe/Novell.Directory.Ldap.NETStandard/commit/7f8f45e6df33c7ac4acafb0a481c9682cb0d1964](https://github.com/dsbenghe/Novell.Directory.Ldap.NETStandard/commit/7f8f45e6df33c7ac4acafb0a481c9682cb0d1964)

Now, the server uses the version 3.6.0, so the issue doesn't happen anymore.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Fixed exception in changeset code review

When creating a code review for a changeset, after refreshing the view we were showing an unexpected error message. This error is now fixed

***

## 11.0.16.8551

> **Note:**
>
> **Public** | 2024-04-11

### New

#### All platforms - Desktop GUI

All platforms - Desktop GUI: New option to group or not group pending changes by category

A new option has been introduced in the Pending Changes View to enhance user flexibility. Users can now toggle between displaying pending changes grouping or not-grouping categories (added/changed/moved/deleted).

The new option is available in a new tab called "Visualization" in the Pending Changes View options. Also moved the options "Group changes in change lists" and "View as a tree" to that new tab.

Note that when "Group changes by categories" is disabled, the category icon is displayed in the status column to help classify each change by category.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/e2cc89ad1f87ecceee567d6d295429bbb172556379ac122ccb4909e0087764d7.gif)

An example of the behavior for each of the three options is shown below.

Group changes in "change lists":


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/251adb9251df8963cdba185660645319dd79f3d993d35baccd783467a012d3da.png)

Group changes by categories:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/d02f01349da4630b64375d0419c9d903ab89034bfb5c2a254135377e84b8e6d1.png)

View as a tree:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/d0abe7474b7093be419a1d2c8ab02385435933d7fd9386a843ce7add8b722634.png)

Note it is also possible to combine the options at will:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/9c459388a01573b6a96fc1b074dd038904bf35b69f7145e2b08cc170f00010e7.png)

### Bug

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Fixed "Item with the same key already been added" error in the Pending Changes view

There was a way to end up with a path both "locally removed" and "removed" at the same time, inside the pending changes view. This caused an "Item with the same key has already been added" error.

The following sequence reproduced the error before the fix:

* Remove 'foo.txt' from UVCS (as a result, you get 'foo.txt' as removed, controlled).

* Create a new 'foo.txt' file using the same path.

* Add the new 'foo.txt' to UVCS.

* Delete from disk the foo.txt (as a result, you get 'foo.txt' as locally removed)

Some other operations, like the "incoming changes" also failed with the same error. It's now fixed for all of them.

***

## 11.0.16.8539

> **Note:**
>
> **Public** | 2024-04-08

### New

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: View branches as a tree hierarchy

Now it is possible to switch between a flat (list) view and a hierarchical (tree) view of the branch list.

In the new mode (tree mode), each branch node is collapsible, allowing it to hide and show its children.

There are context menu options for collapsing all and expanding all branches in tree view mode.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/5de8a3ded30295695ee8689e12468d6d928e78b322a4129416c5354b50c51a7f.gif)

#### All platforms - P4Sync

All platforms - P4Sync: Added support for branches with a ':' character.

The mappings between the UVCS branches and the P4 branches are stored in a text file.

The previous parsing of this file didn't support the character ':' in the P4 branch name, so it failed with the following error:

```console
"The file 'reference.mapping.conf' is corrupt. The format of the line '12:3://depot/development/port:camera.' is wrong."
```

Now, it properly supports P4 branches that contain the character ':'.

#### All platforms

All platforms: Allow to disable the SSL certificate revocation list check

By default, the certificate revocation list (CRL) is checked during SSL authentication. This is an online check that could delay the establishment of a new connection due to a network restriction, a network configuration issue, or an issue with the certificate.

This delay on each connection heavily damages the user experience, especially when using the command line, where each command needs to create a new connection.

You can disable the SSL certificate revocation list check by adding the following setting to your client.conf:

```xml
<CheckSslCertificateRevocationList>no</CheckSslCertificateRevocationList>
```

Working distributed, the same issue could happen to the server when it needs to connect to the remote server, so you can disable check on the server too by adding the following setting to the server.conf:

```xml
<CheckSslCertificateRevocationList>false</CheckSslCertificateRevocationList>
```

#### All platforms - WebUI, GUI

All platforms - WebUI, GUI: Comments in code reviews are now sorted by creation date

Previously, code review comments were sorted by modification date. That moved comments to the top of the list after being edited, which was unintuitive. From now on, code review comments will keep their creation date, maintaining their original position in the list.

### Bug

#### Cloud Server - Changed the internal sub repositor…

Cloud Server - Changed the internal sub repositories ID sequence to avoid collisions.

Before, when a new sub-repository was created, it used the first following available ID. Still, this mechanism did not consider the IDs already used by removed sub-repositories, leading to a collision at some operations.

Now, new sub-repositories will use a unique ID that has not been used before.

#### macOS - SemanticMerge failed to start as a standa…

macOS - SemanticMerge failed to start as a standalone application

An issue in the framework prevented SemanticMerge to start as a standalone application. It led to an immediate crash since version 11.0.16.8405. Now it's fixed.

Remember that you can run SemanticMerge independently using the "semanticmerge" argument.

#### All Platforms - Gluon

All Platforms - Gluon: Fix sorting items by size

When sorting the table by size, the sorting was incorrect. Instead of sorting directories followed by files based on size, the sorting appeared random, with sizes not matching any discernible order. Now it's fixed.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Re-request review for "Rework required"

We introduced the Re-request review feature back on version 11.0.16.8486, but it was only available for "Reviewed" status, not for "Rework required" status. Now it's fixed. The button is visible for both statuses.

Now, authors can really re-request reviews for certain users after making all requested changes, indicating readiness for review again.

***

## 11.0.16.8500

> **Note:**
>
> **Public** | 2024-03-14

### New

#### All platforms - Desktop GUI, Command-line client

All platforms - Desktop GUI, Command-line client: Improved the way to handle credentials for different servers

In some scenarios you may use the same credentials to authenticate on different cloud organizations. These credentials are stored independently, and can also expire at different times.

We improved the way we handle the authentication, so now when one of the credentials expire, we try to use the others instead of failing the authentication.

As a result, you will be less likely to be asked to re-enter credentials when trying to connect to a server that you haven't used for a while.

### Bug

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Fixed Index out of range error in Sync View

Users encountered an error when attempting to exclude branches in the Sync View. Right-clicking on a branch and selecting "Exclude Branch" resulted in an index out-of-range error. Now it's fixed.

#### All platforms - Desktop

All platforms - Desktop: Fixed branch explorer loading using the global config

In 11.0.16.8469 we added the new filters in the Branch Explorer view. It was causing issues loading the view when using the branch explorer global configuration. Now it's fixed.

***

## 11.0.16.8486

> **Note:**
>
> **Public** | 2024-03-07

### New

#### All platforms

All platforms: Re-request review feature added

Previously, re-requesting a review was not possible, causing workflow challenges when creators needed to make changes.

Now, authors can re-request reviews for certain users after making all requested changes, indicating readiness for review again.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/555a798bb8c9918846ae6683995247ef01918a2f5908737ff3cc40508d04c769.png)

### Bug

#### All platforms - Desktop

All platforms - Desktop: Fixed a tree performance issue for the workspace explorer view

In 11.0.16.8445 we modified the way to calculate the locks info in the workspace explorer view. This change caused the performance degraded on expanding nodes or the scrolling of the tree. Now it's fixed.

***

## 11.0.16.8469

> **Note:**
>
> **Public** | 2024-02-29

### New

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Enhanced filters in Branch Explorer

We are excited to introduce a powerful new feature in our Branch Explorer: Filters. These filters have been designed to streamline your workflow and enhance your user experience. Here's a breakdown of the key improvements and functionalities:

1. Date Filters Enhancement:

   * The interface for changing date filters has been revamped for simplicity and ease of use.

   * Users now can quickly select predefined date ranges such as last week, last 15 days, month, or 3 months.

   * Additionally, users can still manually select a specific date or date range from the calendar.

2. Automated Last Time Ago Calculation:

   * A significant improvement is the automatic calculation of the last time ago based on the latest changes in the repository. This feature prevents empty diagrams by ensuring accurate data representation, even if the history is not up to date.

3. Branch Filters:

   * A new branch filter feature has been implemented to help users focus on specific branches without having a cluttered interface.

   * Users can easily filter branches based on their working preferences, select specific branches, and save filter configurations.

4. User Filters:

   * The user filter option simplifies the focus on individual work by highlighting the user's changes in orange.

   * Changes from other users are displayed with reduced opacity, allowing users to concentrate on their tasks effectively.

5. Save Filters Functionality:

   * Users can now save date, branch, and user filters for future use, making accessing frequently used filter settings convenient.

6. Other Filters:

   * A new filter excludes already merged branches, enabling users to focus solely on pending work items.

   * Related Branches Option: The related branches feature enhances diagram comprehension by including parent, children, and merged connected branches in the view.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/76cb5a4c66ea8745a757e9a467527221af58d4966dbbdbd2f3abd21928a8037a.png)

### Bug

#### All Platforms - Server

All Platforms - Server: Changes in code reviews will update its modification date.

Before this task, due to the new code reviews window, there were several changes which were not affecting its last modification date, such as changes in the comments or the reviewers status, among others. Now, every change in a code review or other fields related to it, should update the last modification field to the current date.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Mirrored TGA files preview

* Update ImageMagick Library: Upgraded ImageMagick library to version 13.6.0, resolving the issue of flipped images during preview generation.

* Cache Invalidation: Incremented the preview datastore version to invalidate the preview disk cache, ensuring that previously incorrect previews are discarded.

***

## 11.0.16.8445

> **Note:**
>
> **Public** | 2024-02-22

### New

#### All platforms - Gluon

All platforms - Gluon: lock status info for legacy locks is not shown anymore

In 11.0.16.8101, we announced Smart Locks as the replacement for legacy locks, which allows users to work in sequence making changes, and knowing who has an asset locked at any time. This lets multiple users collaborate while retaining the lock on the task branch throughout development and protecting the file from parallel changes.

Legacy locks were still supported for a while. However, as of this version, Gluon will no longer show the status info related to the legacy locks in the explorer workspace view.

You can find more information about Smart Locks in the release notes and the official documentation:

[/unity-version-control/smart-locks](/unity-version-control/smart-locks.md)

[https://www.plasticscm.com/download/releasenotes/11.0.16.8101](https://www.plasticscm.com/download/releasenotes/11.0.16.8101)

Stay tuned because the multiple destination branches support is coming soon!

***

## 11.0.16.8434

> **Note:**
>
> **Public** | 2024-02-15

### Bug

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Improved the way to handle errors when signing in

When there is an error during the sign in process, in some scenarios we were not displaying the error message to the user (e.g., due to the connection with the server or an issue saving the credentials on disk). This was not optimal because the only way to see what went wrong was checking the log files.

We improved this behavior, and now all errors are shown in the GUI.

***

## 11.0.16.8420

> **Note:**
>
> **Public** | 2024-02-08

### New

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Relayout branches in the branch explorer

We added a new option in the branch explorer that allows you to relayout branches at your wish, so you can manually move a branch up and down, instead of letting the branch explorer automatically find a spot for it. This features is available from the context menu when a branch is selected. You can also move multiple branches at a time, or clear all the relayout data if you are not satisfied with the result.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/46e47c89a6e4d3a72247249beade5f364cbba1fa09b922540ec8cae4d0e80449.png)

Additionally, some keyboard shortcuts are also provided (for Windows and Linux / for macOS):

* Ctrl+Up Arrow / Cmd+Up Arrow: move selected branches up.

* Ctrl+Down Arrow / Cmd+Down Arrow: move selected branches down.

* Ctrl+Shift+Up Arrow / Cmd+Shift+Up Arrow: move selected branches to the top.

* Ctrl+Shift+Down Arrow / Cmd+Shift+Down Arrow: move selected branches to the bottom.

* Ctrl+Shift+C / Cmd+Shift+C: clear selected branches relayout data.

### Bug

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: unexpected error refreshing code review window

When refreshing the code review window, if the selected difference was an xlink difference, an unexpected error appeared. Now it's fixed.

The code review window now is prepared to keep the selection for xlink differences too.

***

## 11.0.16.8411

> **Note:**
>
> **Public** | 2024-02-01

### New

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Enhanced diff visibility in Dark theme

Users reported difficulty in seeing the new GUI diff colors in the dark theme. To address this concern, several changes have been applied to enhance visibility:

* The base colors are now more solid and clear in the dark theme.

* A slight decrease in the diff alpha value increases the contrast between diffColor and insideDiffColor.

* The diff alpha value was also increased inside lines.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/03f1ed6618fc9a561e98c50eaf26ee24e355ed44e9a0aaf59acd9e7fbbba294d.png)

#### Windows - Desktop GUI, Gluon

Windows - Desktop GUI, Gluon: Improved ignored.conf for Unity projects

An ignore.conf file is automatically generated for the workspace when it contains a Unity project in order to set up the files that should be ignored.

Now, we have included a new rule to ignore some internal Unity files that are created and deleted constantly under certain circumstances.

#### Windows - Desktop GUI, Gluon

Windows - Desktop GUI, Gluon: Improved the auto-refresh for pending changes view

We improved the mechanism used to detect if there are new changes to check in the auto-refresh operation for the pending changes view.

Now, it's able to detect when there are only changes that affect ignored files, avoiding launching the auto-refresh operation in these cases.

#### Windows - Command-line client

Windows - Command-line client: diff and merge commands now uses the new merge tools

Previously, when you ran a diff from the CLI or a merge with conflicts, we were using the legacy GUI to show the diffs or merge conflicts. We updated this behavior to match macOS and Linux, and the new GUI is used.

#### Linux - Command-line client

Linux - Command-line client: Added support for lightweight platforms without libicu

Now you can run the command-line client (`cm`) in minimal distros without a valid globalization support library (`libicu`) installed in the system.

To do that, set the `DOTNET_SYSTEM_GLOBALIZATION_INVARIANT` environment variable to `1` in order to run the `cm` application.

More info about the configuration options for globalization can be found [here](https://learn.microsoft.com/en-us/dotnet/core/runtime-config/globalization)

#### All Platforms - Command-line client

All Platforms - Command-line client: Allow revspecs collections on getfile | cat command

Before, it was possible to download file revisions one by one using the getfile command along with the --file option to specify the destination. Now, it is also possible to download a bunch of files by defining a whitespace-separated list of semicolon-separated pairs of revspec and destination.

For example:

```text
C:\wkspaces\default> cm find revision
5        1/10/2024 1:35:11 PM dir all      c:\wkspaces\default\#br:/main#0
16       1/10/2024 1:38:42 PM dir tester   c:\wkspaces\default\#br:/main#1
15       1/10/2024 1:38:42 PM txt tester   c:\wkspaces\default\file.txt#br:/main#1
20       1/10/2024 1:39:28 PM dir tester   c:\wkspaces\default\#br:/main#2
19       1/10/2024 1:39:28 PM txt tester   c:\wkspaces\default\fghnfg.txt#br:/main#2
25       1/10/2024 1:40:44 PM dir tester   c:\wkspaces\default\#br:/main#3
24       1/10/2024 1:40:44 PM txt tester   c:\wkspaces\default\fghnfg.txt#br:/main#3
C:\wkspaces\default> cm getfile "revid:25@rep:default@repserver:localhost:8084;file_25.txt" "revid:16@rep:default@repserver:localhost:8084;file_16.txt"
C:\wkspaces\default> ucat .\file_16.txt
content1
C:\wkspaces\default> ucat .\file_25.txt
content1
content2
```

### Bug

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Fix incorrect text in resolve conflicts button when doing a "merge-to"

When performing a "merge-to" operation that involves resolving manual conflicts, the button at the top incorrectly displays "Checkin merge!". The expected behavior is now restored: the button initially says "Resolve conflicts," allowing users to address conflicts. After resolving conflicts, the button appropriately changes to "Checkin merge!"

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Fix crash when previewing JPEG images greater than 1024px.

A crash issue in Gluon occurred when attempting to preview JPEG images with a width or height exceeding 1024 pixels in width/height. On Mac, it led to an immediate crash, while on Windows, it resulted in freezing and then crashing after a few seconds. Now it's fixed.

#### All platforms - Desktop GUI, Gluon

All platforms - Desktop GUI, Gluon: Don't request the user to login when loading repositories

The Login dialog was shown when opening the Preferences window if an issue tracker was previously configured or creating a new workspace from the "Create Workspace" dialog.

***

## 11.0.16.8395

> **Note:**
>
> **Public** | 2024-01-25

### New

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Enhanced Undo performance by 25%

Previously, undoing a large number of files (15k) in the GUI took longer compared to the cm undo command.

The GUI was sluggish because it sent all paths directly to the operation, triggering a platform path resolution for each. This process expanded and made paths canonical while resolving symlinks. On the other hand, the CLI combined and calculated paths after executing an unco operation. Since the GUI always uses pre-resolved platform paths, the path resolution step becomes unnecessary and can be skipped.

Following these adjustments, the undo operation is now 25% faster.

Before the change: 48 seconds for 10,000 paths on the Windows platform.

After the change: 36 seconds.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Enhancements for clearer Diff Viewer comparisons

We've addressed an issue in this release to ensure a more straightforward experience during comparisons. Here's what you need to know:

Problem Before:

Before this update, selecting 'Ignore Whitespaces' or 'Ignore EOLs' would retain the 'SkipFormatChange' setting. If 'SkipFormatChange' was set to "true," no format differences were displayed. This caused confusion as users expected differences when choosing these options.

Resolution:

We've modified the behavior to align 'Skip Format Changes' with 'Ignore EOLs and Whitespaces' in the x-merge.

Updated Usage:

* 'Recognize All': Disables 'Skip Format Changes'

* 'Ignore EOLs and Whitespaces': Enables 'Skip Format Changes'

* 'Ignore Whitespaces': Disables 'Skip Format Changes'

* 'Ignore EOLs': Disables 'Skip Format Changes'

This adjustment ensures a more intuitive experience during comparisons.

#### All platforms - Desktop GUI, Gluon

All platforms - Desktop GUI, Gluon: Tree mode in Pending Changes view

We added a new option in the Pending Changes view to visualize your changes as a directory tree instead of as a list.

This lets you see the changes organized by the directory structure and select all the changes under a directory with a single click.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/7b4fc27b2c64368136ed2727465d072e708ee1dfff738b12005db911e5cd65aa.png)

You can choose the way to visualize the changes in the Options dialog, under the "What to show" tab:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/bf103c5f075f1ea67c3a1fbee00c54afc7b2f97c8f758e3f19a42a5c2b6bfa02.png)

#### All platforms - Desktop GUI, Gluon

All platforms - Desktop GUI, Gluon: Added 2 spaces tab option

We added a new option in the Code Editor preferences that allows you to visualize tabs as 2 spaces


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/5074006a78f3079876b32bd65485f34dd1643936daa3d17cbe79f5449fb60145.png)

### Bug

#### All-Platforms - Command-line client

All-Platforms - Command-line client: Unexpected standard output for machinereadable

When performing a checkin with update and machinereadable options enabled, there were some unexpected lines in the standard output which have been removed. Now every message displayed is properly formatted as expected.

For example:

On a workspace with the selector behind the head of the branch, (checkin would need to have option --update to succeed), perform some changes in any item and then run the following:

```text
cm ci -m=message --startlineseparator=">>>" --endlineseparator="<<<" --fieldseparator="||" --machinereadable --update my-item.txt
```

Before you would get the following:

```text
>>>CI_START<<<
>>>STAGE||<<<
Processing directory conflicts
Processing directory operations
Processing directory operations (downloading revisions)
Processing directory operations (updating workspace)
Processing directory operations (applying filesystem protections)
>>>STAGE||Validating checkin data<<<
>>>STAGE||Uploading file data<<<
>>>STAGE||Confirming checkin operation<<<
>>>CO||/Users/user/wkspaces/mywk/my-item.txt<<<
>>>CHANGESET||cs:999@br:/main@default@localhost:8084 (mount:'/')<<<
```

Expected result

Now all output messages follow the machine readable output specs with no standard output pollution.

```text
>>>CI_START<<<
>>>STAGE||<<<
>>>STAGE||Validating checkin data<<<
>>>STAGE||Uploading file data<<<
>>>STAGE||Confirming checkin operation<<<
>>>CO||/Users/user/wkspaces/mywk/my-item.txt<<<
>>>CHANGESET||cs:999@br:/main@default@localhost:8084 (mount:'/')<<<
```

***

## 11.0.16.8376

> **Note:**
>
> **Public** | 2024-01-18

### Bug

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Don't show the "Close review change" button when loading the Pending Changes view

The Pending Changes view has a "Close change requested in review" button to specify that the checkin is fixing a change requested in a code review. This button should only be visible when the current branch or changeset has a code review with pending changes, but we were always showing it when loading the Pending Changes view.

We fixed this behavior, and now the button is not shown by default and only appears when it's needed.

#### All platforms - Webadmin

All platforms - Webadmin: Now the period can be used as separator for the mergebots and plugins at the webadmin

Previously, having periods as separators in mergebots and plugin names led to an error when clicking on start/stop buttons, making them unusable. According to [https://www.w3.org/TR/html4/types.html#type-name](https://www.w3.org/TR/html4/types.html#type-name), now we support period separators in mergebots and plugin names.

#### All platforms - CLI

All platforms - CLI: Unexpected encoding for output in XML format

Some commands assumed an incorrect encoding for the XML output. Now, by default, "UTF-8" will be used in case no encoding has been specified when calling the command with the "--xml" option.

#### Linux - Server

Linux - Server: Authentication in NameWorkingMode works again in modern GNU/Linux distributions

For some time now, the `NameWorkingMode` authentication mode (which is the default one when installing Unity Version Control on-premise) did not work. This was because system call `getpwent` returned `ENOENT` after retrieving the last `passw` entry, which is not documented (`man getpwent`) but that seems to be standard behavior in modern GNU/Linux distributions using systemd.

This scenario is now contemplated and `NameWorkingMode` works again for out-of-the-box on-premise Unity Version Control setups!

***

## 11.0.16.8355

> **Note:**
>
> **Public** | 2024-01-10

### New

#### All platforms - WebUI, GUI

All platforms - WebUI, GUI: Avoid re-sorting code reviews comments after editing them

Previously, code review comments were sorted by modification date. That moved comments to the top of the list after being edited, which was unintuitive. Now, code review comments are sorted by creation date, maintaining their original position in the list.

***

## 11.0.16.8336

> **Note:**
>
> **Public** | 2023-12-21

### New

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Conversation panel and multiple reviewers for code review

We have redesigned the code review window to include the all new conversation panel. It shows the timeline of the code review, including comments, change requests, questions and status changes all in one place. From this view you can start conversations, or reply to other comments. You can also navigate to the code and see the specific line where a comment was created, or see the changeset where a change request was applied.

Along with this change, we added support for multiple reviewers in a code review. You can now add or remove reviewers from this conversation panel, either specific users or groups. Each reviewer will have their own status, and the global status of the code review will be calculated among all the reviewers.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/407271251544394499cc126b04fac307c441ad378e9d0e1ec5212524dc297ad4.png)


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/93564ed6200fd1ccce5417345f5446f22b5dc59bf570771fee3c42d1b7ab9079.png)

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Improved Code Review view list and filters

The code review list has enhancements to better accommodate multiple reviewers and improve the overall user experience.

* Status Icon in Code Review list: A status icon is now displayed in the status column of the code review list, aligning with the design in the WebUI.

* Filter improvements: The "Assigned to me" filter now supports code reviews with multiple reviewers. Also, it now considers reviews that are in both "rework required" and "under review" statuses (it previously considered only the "rework required" status). This aligns with the Unity Dashboard UX.

* Column adjustments: The unnecessary reviewer column has been removed from the code reviews view. Default column widths have been optimized for a more visually appealing and user-friendly layout.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/a657c968ead6b56272940bdfb31397fd6eb9d5679670d59d3e177ce36e378a5c.png)

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Enhanced Code Review avatar display

The code review interface now provides an improved visual experience by incorporating avatars for reviewers and changeset owners in various panels:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/62de26eab3db3119e2cb266cc687cc133322439719a107ca9dd5d0a27d0ab6c5.png)

#### All platforms - Dekstop GUI

All platforms - Dekstop GUI: Remove dynamic behavior on diff window when changing object selection

Previously, if you selected an object in the branch explorer, branches view or changesets view while having a diff window open, we had a dynamic behavior that updated the diff window's contents with the diff of the new selected object. This feature could be annoying in some situations, for instance when trying to open two separate diffs for different objects.

We decided to remove this behavior, and now when changing the selection from any view, the diff window will remain static.

#### All platforms - Desktop GUI, Gluon

All platforms - Desktop GUI, Gluon: Allow copy of the diff window branch/changeset/label name

The diff window title, which contains the name of the branch/changeset/label, has been made selectable and copyable.

#### DevOps

DevOps: Trunkbot queue processing improvements

We improved the branch queue in the Trunkbot to play nicely with a higher number of enqueued branches.

Before, processing cycles were spaced out when branches were not ready to be tested yet. This was done for performance reasons and also to not stall remote APIs, but it could lead to high unnecessary wait times for branches at the end of the queue.

Now, the Trunkbot is smarter and spaces out the processing of each branch independently of any other. As a result, branches that are ready are dispatched much faster and the Trunkbot is much more responsive and streamlined.

#### All platforms

All platforms: Improved the file conflicts merge with Smart Locks.

Now, merge allows to solve file conflicts if the source revision of the conflict matches the head revision (the revision loaded in the Smart Locks destination branch).

It eases the rebase of branches with file conflicts after some related locks were manually deleted or edited.

This is a server side change.

### Bug

#### All Platforms - CLI

All Platforms - CLI: Circular dependencies on groups solved

There was a bug when listing users from a group with a circular dependency to another group. For instance, group1 contains 2 users and group2; group2 contains 1 user and group1. That circular dependency caused the CLI to get stuck when listing users from either group1 or group2. Now it is fixed, listing the 3 users as expected.

For instance:

```text
cm listusers localhost:8087 --group=group1
```

#### All Platforms - Gluon

All Platforms - Gluon: File conflicts are properly filtered in partial update.

Before, all the file conflicts were processed in the workspace although only a single folder was specified (it ignored it completely).

Now, it only processes the file conflicts of the specified folder. It means, 'cm partial update /doc' will only process the file conflicts under '/doc'.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Fixed wrong context menu when right-clicking on branch explorer

In certain situations, when right-clicking on an object in the branch explorer, we were showing the wrong options for the context menu. So when right-clicking on a branch, the context menu for a changeset would appear. This resulted in unexpected exceptions when using the menu.

We fixed this issue, and now right-clicking will always show the correct menu for the currently selected object.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Fix shortcuts when opening subviews

Sometimes after opening or closing a subview, like the Shelves view in the Pending Changes, the keyboard shortcuts stopped working.

We fixed this issue, and now the shortcuts will always work, regardless of the currently opened views or the last used control.

***

## 11.0.16.8289

> **Note:**
>
> **Public** | 2023-11-23

### New

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Added changeset numbers to the history view

Changeset numbers have been added to the details displayed on items in the History View. This addition allows you to see and filter by changeset numbers for quick navigation to the corresponding changeset.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/b320af972938d4340c134974e5ee5e3d74d0f4c2eb2654ab14ac1eaebdcfa62c.png)

### Bug

#### All platforms - Desktop GUI, Gluon

All platforms - Desktop GUI, Gluon: Paths with white spaces are formatted with percent-encoding

Allowed white spaces in workspace paths, now the '%20' string won't be used when creating a new workspace with spaces in the path.

***

## 11.0.16.8281

> **Note:**
>
> **Public** | 2023-11-15

### New

#### All platforms

All platforms: Faster deletion under folders with lots of files

Improved heavily the time deleting a big number of files when they are under a folder that still loads lots of files.

In our tests, the time deleting 5.000 files under a folder that contained 15.000 files is around x4-x15 times faster, depending on the operation.

This improvement applies to different operations:

* Running an Incoming Changes operation from Desktop GUI or command line (x6 times faster).

* Running a merge operation from Desktop GUI or command line (x6 times faster).

* Running an apply local changes (checkout) operation from Desktop GUI or command line (x4 times faster).

* Running a 'cm rm' operation from the command line (x15 times faster).

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Enhanced support for Asian languages and much more!

We've updated the UI framework to Avalonia 11, and this brings a slew of improvements. Here are the key highlights:

* A new Composition Renderer for enhanced visual capabilities and performance.

* Advanced text rendering with rich text features.

* IME support for diverse input methods.

* Accessibility improvements to ensure inclusivity.

These enhancements make our desktop GUI even better!

#### All Platforms - Desktop GUI, Gluon

All Platforms - Desktop GUI, Gluon: Improved Delete Operation performance

To enhance the GUI's performance, a significant improvement has been made to the delete operation. Instead of processing deletions one by one, it now performs the delete operation in a block by providing a list of paths. Deleting a large amount of files is now 6x faster.

Additionally, progress is now reported meaningfully, indicating the current items processed out of the total items.

#### All platforms - P4 importer

All platforms - P4 importer: Symlinks are ignored

Symlinks changes are ignored when importing changes from Perforce  through the 'cm sync' command. Before, the operation failed if the symlink target didn't exist in disk.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Improved Sync View usability

When you have a sync view with a lot of repositories to sync or a lot of branches in them, it may take some time to load. If this is the first sync view on the list, and you want to check a different one, you would have to wait until it finishes loading before changing to a new one.

We modified this behavior so that you have to manually click Refresh in order to start loading the sync view. This way, if you want to check a different one, you can first select it and then click Refresh, without waiting for the first one to load

We also updated the behavior of the Push/Pull buttons, which now will only be enabled when there are actual changes to push or pull

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Exclude merges from a parent branch in Code Review window

Added a new "Show pending to integrate" button to the Code review window. This button can filter the merged differences from the branch to be reviewed. When this button is checked, all merges pending to be integrated in the main branch will be excluded from the list of changes.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/31fd27182afe8bc1996de09a6d2b5d48b9320fafda45f286f4b0fab2e464e8ed.png)

### Bug

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: 'Index was out of range' error on workspace creation

Fixed an "Index was out of range" error when selecting a repository for a workspace about to be created.

#### All platforms - P4 importer

All platforms - P4 importer: 'Index was out of range' error with big p4 output

The reading of the p4 command output could throw the error 'Index was out of range. Must be non-negative and less than or equal to the size of the collection. (Parameter 'chunkLength')' if the output was too big. Fixed.

#### macOS, Linux - Gluon

macOS, Linux - Gluon: Newly added items appeared as incoming changes

In macOS and Linux, when you performed a check-in of private items from Gluon, adding them to the version control for the first time, we were wrongly showing them in the incoming changes view after the check-in operation. To clear the incoming changes view and the notification, you had to manually perform an update on the workspace.

We fixed this issue, and now nothing appears in the incoming changes view after performing the check-in.

#### macOS - Desktop GUI

macOS - Desktop GUI: Select previous check-in comments on server-side merges

When performing a server-side merge with the "merge from this branch/changeset to" option, we show a dialog to enter the check-in comment. Instead of typing it, you can select a previous check-in comment from a drop-down menu. This menu wasn't working properly on macOS, so we improved it and now it behaves as expected on all three platforms.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/27d4931782bd0485e55a178e35a6d54a36bb2d43c2d7d322d1f11012a91138c5.png)

#### macOS - Desktop GUI

macOS - Desktop GUI: Input lag in server-side merge comment text box

Fixed an annoying extra input lag when entering the comment in the dialog that appears when using the "merge from this branch to…" option (a.k.a. server-side merge). From now on, there won't be any input lag when typing text on that dialog anymore.

***

## 11.0.16.8244

> **Note:**
>
> **Public** | 2023-11-09

### New

#### All clients

All clients: GitSync doesn't push empty folders anymore.

GitSync doesn't push the empty folders that are present in Unity VCS to Git anymore since some Git applications could struggle with them.

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Improved Workspace Explorer Performance

The GUI now handles directories with over 30,000 items smoothly. Expanding nodes and scrolling are now much faster, ensuring a seamless user experience.

### Bug

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Fix selected changeset movement in Branch Explorer

The selected changeset disappeared in some scenarios when navigating the Branch Explorer with the arrow keys. This happened when the destination changeset was out of bounds but close to them.

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: GUI Freezes with a large selection

When attempting to select all 7,000 files in the pending changes view, and then refreshing the view, the GUI became unresponsive for approximately 20 seconds. Now it's fixed.

#### All platforms - Desktop GUI, Gluon

All platforms - Desktop GUI, Gluon: Missing progress in pending changes while refreshing

Show the refresh progress while the pending changes are loading over the empty state message.

#### All Platforms - Gluon

All Platforms - Gluon: Fix sorting items by Size in Configure workspace view

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Null error running a server-side merge

We have fixed a null error while processing file conflicts from a merge from changeset to branch with xlinks. This exception affected the merge and the conflicts couldn't be resolved properly.

***

## 11.0.16.8223

> **Note:**
>
> **Public** | 2023-10-19

### New

#### All platforms - Server can checkin directories wi…

All platforms - Server can checkin directories with lots of direct entries.

The server used a buffer of 5M to calculate the hash of the directory entries. This was not enough for folders with more than 150.000 entries, so the checkin failed. Now, this limit is much bigger.

#### All platforms

All platforms:  Greatly improved the performance while finding locally removed files.

Removed an unneeded check for moved files when the workspace only contains locally removed items, no private or ignored files.

Example: In a working copy with 14K locally removed files, the search took 20 seconds to complete; now it takes 500ms.

Also, improved the search operation for moved items. Before, we downloaded all the locally deleted content to attempt a move-match with private file candidates. Now, we only download those whose size will be a valid match for the existing candidates.

#### All clients

All clients: Client-side check-in triggers support added to partial workspaces

If you configure a client-side check-in trigger, it will now run for partial workspaces:

```console
> cm trigger mk before-clientcheckin MyBeforeTrigger before_trigger.sh
> cm trigger mk after-clientcheckin  MyAfterTrigger  after_trigger.sh
> cm partial update
> cm co file.txt ; cm partial ci

# The triggers (MyBeforeTrigger and MyAfterTrigger) will run before and after the changeset creation!
```

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Improved checkin operation startup time

In the check-in operation, we have made an enhancement to optimize startup time. Previously, the operation included a phase where paths were resolved to expand them and make them canonical, as well as resolving symlinks. However, it was observed that the GUI doesn't require this step. Therefore, we have decided to skip it, resulting in a faster check-in operation.

#### All platforms

All platforms: Faster workspace status calculation with added items.

Improved heavily the time to calculate the workspace status when a big number of items were added under the same folder. This is only noticeable if the number of files is greater than 1.000.

In our tests, the workspace status calculation of 8.000 added files goes from 9s to 0.15s.

The workspace status calculation is performed when running the 'cm status' command or refreshing the pending changes from Desktop GUI & Gluon.

### Bug

#### All platforms - Desktop GUI/CLI

All platforms - Desktop GUI/CLI: Delay in visual feedback during large check-ins

When performing a large check-in, there was a noticeable delay between initiating the check-in and receiving visual feedback through the UI or CLI. This delay became especially prominent during very large check-ins. We were missing notifying visual feedback during the "Assembling check-in data" phase. Now it's fixed.

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI:  Improved performance expanding nodes in the Workspace Explorer

Previously, expanding a node in the Workspace Explorer that contained 18k items took a variable amount of time, ranging from 6 to 15 seconds. This performance issue was impacting the user experience.

Expanding 18k nodes is now significantly faster (about 750ms), enhancing overall usability.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Show notification dialog when pending changes in diff window

The Unsaved changes dialog will be shown in Diff window after a new branch/changeset selection is done and exist any pending changes to save/discard in the diff view.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Super-slow check-in of many deleted files.

The pre-processing time of the checkin operation (when launched from Desktop GUI) was super-slow when the changes to checkin included lots of files deleted under a folder that still loaded lots of files.

Let's see a scenario where it happened: there is a folder '/Assets' with 20.000 files. If we deleted 10.000 of them and tried to check them in from the Desktop GUI, the check-in operation took more than one hour to start. Now, it only takes around 50s. This means x100 times faster.

As a workaround for this slowness, you could disable symlink support on Windows in the client.conf file: `<EnableSymlinkSupportOnWindows>no</EnableSymlinkSupportOnWindows>`.

This problem also happened from the command line if the 10.000 deleted paths were passed as individual arguments to the 'cm checkin' command (not very common, but possible).

***

## 11.0.16.8204

> **Note:**
>
> **Public** | 2023-10-05

### New

#### All platforms

All platforms: Faster checkin of added items in partial workspaces

Improved heavily the time to check added files in when a big number of them are located under the same folder. This is only noticeable if the number of files is greater than 5.000.

In our tests, the improved step when checking 50.000 files in goes from 250s to 0.25s. The overall check-in time could go from 270s to 20s (depending on the files size to upload).

### Bug

#### macOS - Desktop GUI

macOS - Desktop GUI: Fixed preferences dialog getting the UI stuck

If you try to shelve or checkin some changes with an empty comment, a dialog appears by default asking for confirmation. In that dialog, there's a link to open the preferences dialog in case you want to prevent that warning from appearing in the future.

There was an issue in macOS that caused the preferences dialog to show behind the warning in that scenario, rendering the GUI unresponsive as a result. It is fixed now.

***

## 11.0.16.8196

> **Note:**
>
> **Public** | 2023-09-28

### New

#### Command line client

Command line client: Faster full checkin in partial workspaces

Improved heavily the time calculating the changes to checkin in partial workspaces with lots of added items.

In our tests, the time calculating the changes to checkin for 300.000 files goes from 180s to 1s.

### Bug

#### All platforms - Gluon

All platforms - Gluon: Configuration tree didn't refresh properly

The configuration tree in Gluon didn't allow to change the check status of items that were changed previously when a refresh was done. For example, when any file/folder was marked to unload and then the refresh button was clicked, it was not possible to switch back this status to load again and an error message was displayed on the bottom.

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Replace shortcut to open a workspace from the Home view

In the Home view, the shortcut to open the selected workspace in a new window was Shift+O. This shortcut was being executed when trying to type Shift+O in the filter text area.

We changed the shortcut to Ctrl+O

#### All platforms - Desktop GUI] Improved horizontal…

All platforms - Desktop GUI] Improved horizontal scrolling speed

Previously, scrolling horizontally (SHIFT + mouse wheel) in the Branch Explorer was noticeably slower compared to the legacy GUI. To address this problem and enhance the scrolling experience, we have increased the horizontal scroll size from 10px to 250 pixels and also the vertical scroll size from 10 pixels to 32 pixels.

These changes should result in significantly improved horizontal scrolling performance in the Branch Explorer, making it more in line with user expectations.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Fixed memory leak in DiffWindow/DiffViewer/DiffControl

Previously, there was a memory leak in the DiffWindow, DiffViewer, and DiffControl components, leading to increased memory usage over time. We've addressed this issue by identifying and fixing several memory leaks.

***

## 11.0.16.8183

> **Note:**
>
> **Public** | 2023-09-21

### New

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Show icon when permissions are marked as overridden

A new icon will be displayed when any permission from the Permissions dialog is selected to be overridden, it will be applied to the selected column "Allowed" or "Denied".


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/59a1bd9a2ac553d3891d56198d1b296cb2aeafe871bd30fa836d0e160a6c1768.png)

#### All platforms - Desktop GUI, Unity Plugin

All platforms - Desktop GUI, Unity Plugin: Use the same default organization for the Desktop GUI and the Unity Plugin

Now, if you select an organization after doing the onboarding in the Desktop GUI or the Unity Plugin, the selected organization will be saved by default for both places.

#### All platforms - Desktop

All platforms - Desktop: New Cloak options for browsing a changeset

Now, when browsing a changeset in a workspace, users will be able to add and remove items from the cloak filter using the context menu on the files or directories.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/9753a01f006e4701069cb9e0a609e34d85a9a06409b1132d21c552cbde4eb21f.png)

Click here for more info about cloaked files: [https://docs.plasticscm.com/book/#\_ignoring\_private\_files\_with\_ignore\_conf](https://docs.plasticscm.com/book/#_ignoring_private_files_with_ignore_conf)

#### Command-line client

Command-line client: cm listuser --group now fails if the group does not exist

If you set a group that does not exist, the command will explicitly notify you about it.

```console
> cm listuser --group=edvelopers
The 'edvelopers' group does not exist.
%ERRORCODE = 1%
```

### Bug

#### Command-line client

Command-line client: cm patch command fails unexpectedly

The patch command failed with the following error message in certain scenarios involving permission changes.

```console
> cm patch cs:123@repository@organization@cloud

Error: Object reference not set to an instance of an object.
```

Now those cases are handled gracefully, and the command will run to completion.

#### Command-line client

Command-line client: cm checkout message does not belong to the machine-readable output

The following message was wrongly shown by the checkout command when using the --machinereadable option:

```console
> cm checkout --machinereadable
The selected items are about to be checked out. Please wait ...
(...)
```

The message is actually intended for human users. Now we don't print it anymore in this mode.

***

## 11.0.16.8168

> **Note:**
>
> **Public** | 2023-09-14

### New

#### All platforms

All platforms: Improved merge file conflicts with Smart Locks

1. A file is always checked-out when solving a conflict. It doesn't matter the type of resolution chosen (merge, keep source or keep destination). This prevents the creation of parallel changes while a merge is being processed in a workspace.

2. Before, when solving a file conflict with an existing lock in Retained status, the destination of the merge had to always be the retained revision. This implied running an extra merge (rebase) from the destination branch (/main) to the branch to integrate (/main/task) before integrating the branch into /main. Now, the branch that contains the Retained revision (/main/task) can be directly integrated into the destination branch (/main) so the file conflicts are solved there without any extra step.

### Bug

#### All platforms - Plugin for JetBrains IDEs

All platforms - Plugin for JetBrains IDEs: Fixed wrong diff calculation after applying a shelve

The UVCS plugin for JetBrains IDEs calculated the wrong diffs for items that were checked out in the workspace as a result of applying a shelve using a UVCS client (GUI/CLI) outside the IDE. Now it's fixed.

#### Command-line client

Command-line client: Partial check-in progress bar glitches

When running a partial check-in operation, the progress bar line and the results were overwriting each other in the command line.

Now both are displayed properly.

```console
/ Confirming checkin operation 417 bytes/417 bytes [################################] 100 %
Modified c:\Engine\README.txt
Created changeset cs:3@br:/main@Engine@localhost:8084 (mount:'/')
```

#### Command-line client

Command-line client: Switch and partial switch will now take into account the workspace repository

Before, running the "cm switch" or "cm partial switch" commands under a Xlinked directory, the default repository was the Xlinked one. This behavior was confusing, and it could produce unexpected changes in the workspace:

```console
$ cd xlink
$ cm switch br:/main # CAUTION: Switching to a different repository
```

Now, the top-level repository is used by default for these commands. If you really need to switch to a different repository, you can still achieve it by explicitly typing the destination repository:

```console
$ cd xlink
$ cm switch br:/main@XlinkedRepository
```

#### All platforms

All platforms: Merge didn't release locks for file conflicts with keep destination resolution

The lock was ignored after solving a file conflict with the keep destination resolution. So, if there was a lock related to that merge, the lock could get out-of-dated. This happened for client-side merge and server-side merge. Fixed.

#### All platforms - All clients

All platforms - All clients: Fixed the update progress message in Japanese

We applied a more accurate wording in the Japanese localization for the message that gets displayed while updating a workspace.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Added ScrollViewer to the initial login window

Previously, when launching the GUI with no configuration (no accounts) and resizing the window to a minimal height, the controls were being cut off, and a scrollbar was not displayed as expected.

Now, we have introduced a ScrollViewer to the view. This means that when the contents do not fit within the screen height, a scrollbar will automatically appear, allowing users to access all controls even in smaller windows. Screenshot:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/931a13ec93a47da6e6e30f86ecb10654a9ee586773de51977e0e049227cd571d.png)

#### All Platforms - Text Merge Tool

All Platforms - Text Merge Tool: Comparison Method options cannot be deactivated

Previously, the three comparison method options (Ignore EOLs, Ignore Whitespaces, Ignore EOLs, and Whitespaces) were always checked and could not be manually deactivated by the user. Now it's fixed.

***

## 11.0.16.8153

> **Note:**
>
> **Public** | 2023-08-31

### Bug

#### All platforms

All platforms: Server-side merge failed with locks.

The server-side merge (merge-to) operation failed when processing a file that was only modified on the source if it was under lock rules. It could fail with both legacy locks and Smart Locks. This has now been fixed.

#### macOS - Desktop GUI

macOS - Desktop GUI: Opening bad links no longer closes the app

After opening a link that pointed to an unreachable server, the application closed automatically when the user dismissed the message popup that appeared.

We now keep the main window open after the popup is dismissed, so the user doesn't get the impression that the application crashed.

***

## 11.0.16.8133

> **Note:**
>
> **Public** | 2023-08-03

### New

#### All platforms - Desktop, Gluon

All platforms - Desktop, Gluon: Improved handling of purged revisions in the GUIs

Several views can now detect a purged revision.

In the views that show a list of revisions (such as the History view) the purged revisions now have a trash icon and a different visual style. A tooltip also indicates purged revisions from the list.

In the Differences view, a message indicates the revision was purged. This Differences view appears in different places within the application: the History view, the Diff window, the Code Review window\...


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/2f99e82505b64b1c8cab4b83f914769699782c5a28c4ae9d7438b384c2adb0a2.gif)

#### All platforms

All platforms: Restrict code review status changes to reviewers

From now on, only a reviewer will be able to update the review status.

When there is no reviewer assigned to a code review, the GUI will allow updating its status by any user, as before.

#### All platforms - Triggers

All platforms - Triggers: The "edit review" trigger includes the reviewer edition action

Now, the add reviewer, update reviewer, and remove reviewer actions also run the edit-review triggers and set the following info on the `PLASTIC_REVIEW_ACTION` and `PLASTIC_REVIEW_ACTION_INFO` variables

* Add reviewer

  * `PLASTIC_REVIEW_ACTION` -> add reviewer

  * `PLASTIC_REVIEW_ACTION_INFO` -> James

* Remove reviewer

  * `PLASTIC_REVIEW_ACTION` -> remove reviewer

  * `PLASTIC_REVIEW_ACTION_INFO` -> James

* Update reviewer status

  * `PLASTIC_REVIEW_ACTION` -> update reviewer

  * `PLASTIC_REVIEW_ACTION_INFO` -> James:Reviewed

#### All platforms

All platforms: Server-side merge takes into account the exclusive check-out rules

Before, the server-side merge (merge-to) operations ignored the exclusive check-out rules (lock rules). This happened both for Smart Locks and the legacy lock system. This misbehavior could lead to file conflicts although the lock rules were in place.

Now, the exclusive check-out checks & operations run from merge-to too. The operation now behaves the same as if you run the merge from the client side, and can not lead to file conflicts.

#### All Platforms - Client Command Line

All Platforms - Client Command Line: The cloaked configuration is now taken into consideration in encrypted organizations

When working on an encrypted organization, the encryption key is stored in the client for security reasons - it never reaches the server.

Because of this, the server could not apply the cloaked filter stored in the server (apply the cloak before even attempting the download). It could only use the cloaked filter stored in the workspace, which could be out of date.

Now the server can read the cloaked.conf stored in the server without compromising the security. For encrypted organizations, the client first downloads the cloaked.conf in the server. This way the client can use the latest version, regardless of its encryption status.

### Bug

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Fixed an exception when removing all accounts

The GUI could throw an error under some circumstances when removing all accounts. Now if you remove all accounts you will see the onboarding again, as if you had a clean setup.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Fixed an exception when pressing Ctrl+F

When pressing Ctrl+F / Cmd+F in the Workspace Explorer the GUI threw an error if the search box was empty. Now you can use the search shortcut as normal.

***

## 11.0.16.8108

> **Note:**
>
> **Public** | 2023-07-13

### Bug

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Text displacement when scrolling in help panel

There was an issue with the help panels that had long text lines: when scrolling through the text and making the long lines invisible, the whole text was horizontally moved to one side. We fixed this issue, and now scrolling in the panel doesn't affect the alignment of the text inside it.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/2bd3c7d98f39088d0689a3f30fe01cd6c2a7386a6a62290cb7dd55edfda2fae1.gif)

#### WebAdmin

WebAdmin: Wrong results when diffing branches

The endpoint to calculate the diff for two branches was returning wrong results when comparing with the "pendingToIntegrate" query parameter, as it was not considering that the branch can have several children branches.

***

## 11.0.16.8101

> **Note:**
>
> **Public** | 2023-07-06

### New

#### All platforms

All platforms: Introducing Smart Locks

There are many kinds of files that present a challenge for merging content changes:

* Unity scenes

* 3D models

* Images and texture maps

* Sound files

* Excel spreadsheets

* Etc...

It is quite easy to see how important it is to apply changes to these assets sequentially and always iterate over their last revision. The creation of parallel histories usually means that some changes are discarded and redone down the line, since conflicts in these files cannot be merged.

So far, you could set up these lock rules to guarantee that nobody else made changes to the same file at the same time. When you were done, changes were checked in — or unchecked out — and the lock was removed. This "legacy" lock system was devised mainly for artists that work on a single branch, forcing the user to work on the last revision of the branch.

However, protection did not extend to multi-branch scenarios, allowing the creation of parallel changes in different branches:

1. Alice made some changes to `player_icon.jpg` at `/main/level_12`. The scene is waiting to be integrated, and the file is not locked anymore.

2. Bob is working on its own branch (`/main/level_11`) and makes a quick change to the same file too.

Yes, both are using the last revision on their branch, but they don't take into account new revisions in other branches.

Now introducing Smart Locks.

Smart Locks are the mechanism that Unity DevOps Version Control uses to track which branch retains an asset for edition, and it works as a baton pass or as a "torch". Even if the file is not exclusively checked out right now, task branches retain the lock and prevent developers from checking out an outdated revision in a different branch.

Moreover, locks are not retained by the users who created them. As long as they keep working with the last revision, other developers can still exclusively check out the file you just checked in! This is true even for multi-branch scenarios.

In other words, Smart Locks ensure a single line of development for assets among different branches while enabling collaboration between developers. Long gone are the days when you needed to keep a physical token on your desk to let your colleagues know that you were holding an asset: Unity DevOps Version Control keeps you covered.

\== CREATING SMART LOCKS ==

Smart Locks are here to replace legacy locks, and the new version of the server already uses them from the get go (see details in the 'COMPATIBILITY' section). If you were already using locks, you probably just need to upgrade.

First of all, you need to set up the lock rules (if you don't already have them!):

```text
# Contents of the lock.conf file.

rep: * br:/main
*.UNITY
*.dae
*.mkv

rep: myrepo br:/main excluded_branches: /main/experiment /main/experiments/* */art-concept */art-concepts-*
*.jpg
*.png
*.wav
```

Note that there are two new optional fields available in the lock rules:

1. The "destination branch" — br:/main by default — is the source of truth when creating a new lock: the revision loaded here is considered the last revision. Locks created in other branches are not released until they get integrated back into the destination branch.

2. Some "excluded branches" where the lock rules are ignored. Note that you can use wildcards at the beginning and at the end. Excluded branches are matched by name, so bear it in mind when renaming branches!

After setting up the rules, you can create a task branch and try to check out a file. The "lock list" subcommand will help you to inspect which locks are in place and their current status:

```text
> cm co fmv_intro.mkv

> cm lock list --anystatus
myrepo  1932  6/27/2023 10:02:11 AM /main  241  /main/task 241  Locked  mikel  mywk  /assets/fmv_intro.mkv

# Do some changes and check them in!
> cm ci

> cm lock list --anystatus
myrepo  1932  6/27/2023 10:02:54 AM /main  241  /main/task 242  Retained  mikel  mywk  /assets/fmv_intro.mkv

# cm lock list --help
```

Within the Desktop GUI, the Workspace Explorer now tells explicitly which files are locked by other users, and they are represented with special icons for clarity.

Also, a new panel was added to the Desktop GUI and Gluon to display the Smart Locks that currently exist in the workspace repository. Since there, you can release or remove the locks too:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/e02ffc1b49b091ae9794ee3b09f2dfaff91ee7b653e236285983a20db0919324.png)

Moreover, this panel is available in both, the Workspace Explorer and the Home View, so you don't even need a workspace to manage the locks of a repository.

Likewise, the same functionality is provided by the WebUI:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/03bef409dbef08ed2a630829e422e38b0fc91dd82822e5d1119d9e96b4790056.png)

> **Note:**
>
> Note legacy locks as they are not truly tied to specific repositories, so they cannot be visualized this way. Running `lock list --anystatus` shows all the server locks by default, so you can use it to find them if necessary.

See in detail how to configure exclusive check-out using an on-prem server in our administrator guide:

[https://docs.plasticscm.com/administration/plastic-scm-version-control-administrator-guide#Chapter7:Configuringexclusivecheckout(Lock)](https://docs.plasticscm.com/administration/plastic-scm-version-control-administrator-guide#Chapter7:Configuringexclusivecheckout\(Lock\))

\== LIMITATIONS ==

* Smart Locks do not travel across replicas.

* Replicas might add newer revisions to the repository, leaving the lock outdated.

* Some scenarios involving changeset deletion might leave the lock outdated for obvious reasons.

* Merge-to does not support locks — neither legacy nor smart ones —... yet! Stay tuned.

Even if you bump into such scenarios, none of them are unrecoverable. See the following section.

\== REMOVING AND RECREATING LOCKS ==

You might land in a situation where a lock must be forcefully unlocked — maybe somebody locked an asset and forgot to release it, or maybe a lock was invalidated for some other reason.

You can use the Desktop GUI, Gluon, or the WebUI to release or remove the lock. Alternatively, you can also use the "lock unlock" subcommand:

```text
# Unlocks the lock for the item id 56 in the repo 'myrep@myorg@cloud'.
> cm lock unlock itemid:56@myrep@myorg@cloud

# Unlocks the lock of an item by path.
> cm lock unlock /home/user/workspace/foo.psd

# Not just unlock the item, remove it entirely.
> cm lock unlock foo.psd --remove

# cm lock unlock --help
```

By the way, if you really need to remove a lock entirely, you might want to recreate it somewhere else. You can use the "lock create" subcommand for that. Lock rules already determine which is the destination branch, but you still need to explicitly specify the holder branch, like so:

```text
# Creates a lock for the item id 56 in the branch /main/task@myrep.
> cm lock create /main/task@myrep itemid:56@myrep

# Creates a lock for the selected item in the branch /main/task.
> cm lock create br:/main/task item:/home/user/workspace/foo.psd

# cm lock create --help
```

\== COMPATIBILITY ==

* Before, lock rules allowed a lockserver field (although this was barely used and could introduce some issues). It won't be supported anymore.

* Old versions of the client can perform exclusive check outs over files, but they won't be able to release Smart Locks, only legacy ones. If you try, you will be prompted to upgrade in order to continue.

* After upgrading, legacy locks already in place will stay as they are. But as soon as files get checked in or unchecked out, the legacy lock will be gone. The next time you check out such files, they will start using the new system.

* There could already be parallel versions of some files (coming from legacy locks, if they were used this way). In this case, some manual operations could be needed to continue working with these files during this transition to Smart Locks. 'cm lock unlock' and 'cm lock create' are here to help.

* Legacy locks will still be supported, at least for a while. Indeed, you can disable the new behavior in the server by adding the following key to the server.conf:

```text
<EnableSmartLocks>false</EnableSmartLocks>
```

You can find more information in the official documentation:

[/unity-version-control/smart-locks](/unity-version-control/smart-locks.md)

#### Command-line client

Command-line client: cm update now has its own update report

The update command usually does not show an update report. Instead, it shows a progress bar (if used interactively) or all the relevant events that happen on items as they are updated (a behavior intended for tool automation).

However, the progress bar does not clearly communicate errors. Now using cm update interactively features an update report at the end, which helps to better understand what happened:

```console
> cm update
| Finished       [####################] 100%  510/510 MB - 204/204 file
Error updating 'c:\wks\Game\Source\main.cs': (...)
Warning updating 'c:\wks\Game\Source\Utils.cs': (...)
>
```

### Bug

#### All platforms - Desktop GUI, Gluon

All platforms - Desktop GUI, Gluon: Links not properly formatted in release notes

The release notes were not properly formatted when any link tag was included, we have included a fix in order to accept the different link formats we support.

***

## 11.0.16.8077

> **Note:**
>
> **Public** | 2023-06-29

### Bug

#### Command-line client

Command-line client: cm checkin --silent option not working properly

Before, progress text was shown even when the --silent mode was specified. Now it won't be shown anymore.

#### All platforms - Desktop GUI, Gluon

All platforms - Desktop GUI, Gluon: Test Issue tracker connection failing

An error message was shown when trying to test a valid issue tracker connection, now the green tick will appear if the connection is correct.

#### All platforms - WebAdmin

All platforms - WebAdmin: Fix Lock Rules section

Opening the Configuration / Lock Rules section failed with a "something went wrong" error. This happened since 11.0.16.7995. Now it's fixed.

#### Windows, All clients

Windows, All clients: Path errors when mounting drives as directories

When drives are mounted as directories in Windows, a junction mount point is created for it. Unity DevOps Version Control was overzealously solving their target paths, leading to some errors and glitches.

Now, these paths are properly acknowledged, allowing more complex workspace setups.

***

## 11.0.16.8060

> **Note:**
>
> **Public** | 2023-06-22

### New

#### All platforms

All platforms: Trim your repository size with Purge

Real-time 3D projects can grow substantially in storage size. The iterative nature of development leads to the creation of multiple revisions of large files that, by design, are kept safely stored in Unity Version Control. Although we keep this behavior as the standard, we also want to provide our customers with flexibility so they can choose how to better manage their data.

We are excited to introduce Purge. You'll have the power to permanently delete those old, unused revisions and trim your repository data, leaving room for the ideas that lie ahead. You'll be able to select a specific period of time and file extensions you want to remove, and in a few steps, you'll get your repository shrunk.

Important note: This operation is destructive and irreversible. While we want to give users the flexibility to have the ability to control their repositories, we also don't recommend purging your repositories. Unity Version Control is designed to keep the history of your project fully registered as long as it lives, and the use of purge means that you are losing data.

\== A feature with safety features in mind ==

While this operation is destructive and irreversible, we designed it to preserve the most vital revisions. This ensures that you will always have stable checkpoints inside your repository.

The purging process calculates the scope of your requests, skipping those revisions loaded at the head of a branch or if they exist in a changeset with a label. These simple safety features guarantee that you can always return to any label or branch head.

\== Try now on your CLI ==

Purge is only available through the command-line interface, where you can calculate, execute, and consult the history of your operations. Don't forget to set permissions for it and to keep it as an administrator-only functionality.

First, you will need to request a purge. This is done using the "cm purge register" command, specifying the file extension and the 'before' date when to apply the purge.

```console
> cm purge register ".png" "2023-Jun-21 13:40" --repository=prince
A7919afc-45af-4c58-a5b8-c54c32f1c0ea
```

The register command will return you a purge GUID, this value can be used to check its status via the `cm purge show` command:

```console
> cm purge show a7919afc-45af-4c58-a5b8-c54c32f1c0ea
PurgeId: a7919afc-45af-4c58-a5b8-c54c32f1c0ea
Repository: prince
Author: manu
Status: ReadyToPurge
Purge size: 77 revisions, 290.06 MB
.png: 77 revisions, 290.06 MB
```

Once you are sure you want to run the purge operation, you will need to use the `cm purge execute` command, specifying the purge GUID you want to execute.

```console
>cm purge execute a7919afc-45af-4c58-a5b8-c54c32f1c0ea
PurgeId: a7919afc-45af-4c58-a5b8-c54c32f1c0ea
Repository: prince
Author: manu
Status: ReadyToPurge
Purge size: 77 revisions, 290.06 MB
.png: 77 revisions, 290.06 MB
```

You'll need to confirm the request to safeguard the process.

```console
This operation cannot be undone or canceled. You will permanently lose the revisions of these files.
Tip: if you want to inspect all the affected revisions, do NOT continue and run this command:
  $ cm purge show a7919afc-45af-4c58-a5b8-c54c32f1c0ea --verbose --server=localhost:8787
Are you sure you want to execute the purge? (y/n)
y
The purge action is now running.
```

Lastly, you can use the command `cm purge history` to check the specific status of one purge or previously executed purges.

```console
> cm purge history
a7919afc-45af-4c58-a5b8-c54c32f1c0ea PurgeCompleted
```

\== Check out the complete CLI documentation and learn more about Purge ==

Since we are talking about CLI, we recently updated and brought the documentation to the web, making it easy for everyone to find, search, and learn about every available command and the extensive list of capabilities from Unity Version Control.

[/unity-version-control/uvcs-cli/version-control-cli](/unity-version-control/uvcs-cli/version-control-cli.md)

\== How to Access ==

You can visit our webpage and download the latest version right now:

[https://www.plasticscm.com/download](https://www.plasticscm.com/download)

Please note that this feature is only available through the Unity Version Control CLI for Cloud customers. Only new Cloud organizations will have the new 'purge' permission enabled by default for the "Administrators" group. If you want to start using this feature, make sure you grant the 'purge' permission first.

If you are not a customer or want to start using Unity DevOps for free, you can subscribe here:

[http://www.unity.com/products/unity-devops](http://www.unity.com/products/unity-devops)

### Bug

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Pending merge links were not visible with no pending files

The empty state message was displayed in the Pending Changes view without considering any pending merge links, just taking into account if there were files with pending changes to check-in. Now the empty state message won't be shown when pending merge links are detected.

***

## 11.0.16.8051

> **Note:**
>
> **Public** | 2023-06-14

### New

#### All platforms - Desktop GUI, Gluon

All platforms - Desktop GUI, Gluon: Updated to Avalonia UI v11

In this release, we updated the apps to use the new version of Avalonia UI framework, which includes clear type rendering for Windows and some improvements in the Asian languages support for the edition.

In addition, Avalonia UI v11 carries the most substantial changes in their API to date, setting it up for a thriving future to ensure a more robust and reliable UI.

#### All platforms - Desktop GUI, Gluon

All platforms - Desktop GUI, Gluon: Empty state when view has no items

The empty state message will be displayed when no element is found for the current main view. This empty state message has been added for all Unity VCS main views except for the Branch Explorer, Branches and Changesets views, and for all Gluon main views except for the Changesets view. The context menu will be available for some of those views in this empty state, in order to use some basic actions.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/f46f4bcf73ae0339f8963a7c330606b3bcf0b8b5e57c0057bc8d2e5f7de49ce0.png)

***

## 11.0.16.8044

> **Note:**
>
> **Public** | 2023-06-08

### New

#### Windows - All clients

Windows - All clients: Symlink support is now enabled by default

Windows symlink support was released in Plastic 11.0.16.6979 on May 19th, 2022. That's quite a while!

Now symlink support is enabled by default for all machines running Windows 10.0.14972 or newer. You can check which Windows version you have by running cmd.exe:

```console
Microsoft Windows [Version 10.0.14972.1000]
(c) Microsoft Corporation. All rights reserved.

C:\>
```

\== REQUIREMENTS ==

To actually use this feature, you need to enable Developer Mode in Windows. To do so, you just need to type 'Developer Settings' into the Cortana search box, in the taskbar, and switch the 'Developer Mode' toggle on:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/6b53ca7c8d0e184b940cb09ea25b06be877fc7d86f4ada705f6d3ba2c1c731b6.png)


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/8a44da3c5535143bc17f311ac918892163e9dcb129728c062bbd0d3e081ecf68.png)

[https://docs.microsoft.com/en-us/windows/apps/get-started/enable-your-device-for-development](https://docs.microsoft.com/en-us/windows/apps/get-started/enable-your-device-for-development)

If for some reason you are not allowed to enable it and your repository contains symlinks already, you might want to keep the old behavior. To achieve that, you can simply disable the feature by setting the following configuration key in your client.conf file:

```console
<EnableSymlinkSupportOnWindows>no</EnableSymlinkSupportOnWindows>
```

\== HOW TO UPGRADE ==

If you already have some symlinks in your repository, your workspace will have placeholder files loaded in the tree.

To upgrade an existing workspace, you just need to remove those files from the disk (for instance, using Windows Explorer) and undo your changes in Unity DevOps Version Control immediately after. This will force it to recreate the items as proper symlinks.

\== HOW TO CREATE SYMLINKS ON WINDOWS ==

You can use the same Unity DevOps Version Control commands and options you would use on Linux or macOS:

```console
C:\wkspaces\sokoban> mklink /D Scripts Assets\Scripts
C:\wkspaces\sokoban> cm add Scripts
The selected items are about to be added. Please wait ...
Item c:\wkspaces\sokoban\Scripts was correctly added
C:\wkspaces\sokoban> cm ci --symlink Scripts
The selected items are about to be checked in. Please wait ...
- Checkin finished 26 bytes/26 bytes [################################] 100 %
C:\wkspaces\sokoban> cm co --symlink Scripts
The selected items are about to be checked out. Please wait ...
Item c:\wkspaces\sokoban\Scripts was correctly checked out
C:\wkspaces\sokoban> cm undo --symlink Scripts
c:\wkspaces\sokoban\Scripts unchecked out correctly
```

\== ADVANCED USERS ==

Conversely, if you want to enable the feature using an older version of Windows, you can set the same configuration key explicitly:

```console
<EnableSymlinkSupportOnWindows>yes</EnableSymlinkSupportOnWindows>
```

Mind you, this implies an advanced usage and involves running Unity DevOps Version Control with the administrator account. Whereas such usage is discouraged for obvious reasons, it is allowed.

#### All platforms - Command-line client

All platforms - Command-line client: "cm log" command learns "--dateformat" parameter

The `cm log`  command is now able to set a date format to print the log entries with the specified date format.

Example (will print the dates in universal sortable dateformat):

```console
$>cm log --dateformat=u --csFormat={changesetid}({date}){newline}{items}
6022(2023-02-17 22:02:55Z)
 C vmachines.conf
 C testprograms\obs.auto.hal.txt
```

#### All platforms - Unity DevOps Version Control, Glu…

All platforms - Unity DevOps Version Control, Gluon: Shelves improvements

We improved the discovery for the Shelves view by opening it the first time you use the app.

The state of the Shelves view is remembered as a user preference in order to be shown or not when you open the application again.

Also, we implemented an empty state to appear if the user doesn't have shelves, or if the user executes a query without results.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/f98a07cedce080bb235f10fdd7792ceef69b3793499ebcfbda383ccb44f4e05f.png)

### Bug

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Workspace Explorer search crashes

The Workspace Explorer search for very large workspaces has been improved in performance and memory management, and the results are displayed sorted by path. In addition, the search will only be executed from 3 characters as it is done in Gluon.

***

## 11.0.16.8022

> **Note:**
>
> **Public** | 2023-06-01

### New

#### All platforms - Desktop GUI, Gluon

All platforms - Desktop GUI, Gluon: New option to display cloaked files in pending changes

As part of the pending changes options, we added a new option to display cloaked items. Now, you can see any cloaked file with changes in the pending changes view enabling this new option.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/389182e1d3ead2ced57eed609af4b28d1c168a256741f088eda43b8f0cd6cd54.png)

#### All platforms - All clients

All platforms - All clients: Files modified only on source are checked-out in cherry picking.

Now, cherry picking, subtractive and interval merge checkout the files that are modified only on source before applying the change in the workspace.

This way the lock mechanism is respected for these kind of merges to avoid creating file conflicts for non mergeable files easier.

### Bug

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Home view refresh doesn't keep the selected organization

If you changed the selected organization in the Home view, the next time the window was activated the selected organization was changed to the first value in the list.

We fixed this issue and the selected organization now is preserved.

#### All platforms - Desktop GUI, Gluon

All platforms - Desktop GUI, Gluon: Shelve empty comment warning configuration issue

The ShowEmptyShelveCommentWarning configuration setting just needs to be updated only when it's changed from the 'Preferences' window or when the 'Don't ask me again' option is checked in the 'Shelve empty comment' dialog.

#### Linux - Installers

Linux - Installers: Cannot resolve libicu dependency. Fixed.

Some Debian / Ubuntu distros were showing an error while installing telling that there is an unmet dependency of libicu and cannot be resolved.

Now it is fixed, since "libicu72" is set as a valid alias for libicu dependency.

> **Note:**
>
> Ubuntu 23.04 won't be yet compatible with the installation of the server package. Stay tuned for upcoming fixes in next releases!

***

## 11.0.16.7995

> **Note:**
>
> **Public** | 2023-05-25

### New

#### All platforms -  Desktop GUI

All platforms -  Desktop GUI: Improved undo behavior after creating a shelve

After a new shelve is created, we show a dialog asking if the user wants to undo the changes or keep them in the pending changes. Now this dialog appears before the shelve is created, and it can be closed to cancel the whole shelve operation.

We also added a checkbox that allows to remember the selected option. This behavior can be changed at any time from the preferences


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/a917f579b977b7ef5b06a28d1ddf5bf8185769f71bb57d6748854e76b3fda21b.png)

#### All platforms - Desktop GUI, Gluon

All platforms - Desktop GUI, Gluon: Improved the style of the sign-in dialog

New layout modifications have been done in the sign-in dialog.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/83a617622bf3b72db748ab2116571ad1bc105cf9c117ab4122333f46ea7b3202.png)

***

## 11.0.16.7978

> **Note:**
>
> **Public** | 2023-05-18

### New

#### The Unity Version Control CLI documentation is no…

The Unity Version Control CLI documentation is now live on the web!

Previously, we were missing the complete documentation with all commands, and the only way to access it and understand how to use the command line was through internal help. Now there's a comprehensive guide available for everyone!

You can find the documentation here:

[/unity-version-control/uvcs-cli/version-control-cli](/unity-version-control/uvcs-cli/version-control-cli.md)

It's packed with detailed explanations, examples, and usage instructions for all the Unity Version Control CLI commands. Whether you're a seasoned pro or just getting started, this resource will be invaluable.

Keep in mind that this is the first published version. While it's a significant milestone, we recognize that there's always room for improvement.

Stay tuned for more updates on the online CLI help!

#### All-platforms - Command-line client

All-platforms - Command-line client: New mvbranch trigger

We added a new type of trigger, which is called before/after the renaming of a branch. Along with the trigger, we added two new environment variables:

```console
PLASTIC_BRANCH_NEW_NAME
PLASTIC_FULL_BRANCH_NEW_NAME
```

These can be used in combination with previous environment variables for automation purposes (see below).

For instance, it would be possible to create a trigger with the following command:

```console
cm trigger create before-mvbranch MyTrigger "C:\cisystem\trigger.bat C:\cisystem\triggerresult.txt"
```

This script could contain the following - indeed, you can try something like this to set the trigger up and test it!

```console
REM trigger.bat
@echo off

(
echo PLASTIC_BRANCH_NEW_NAME %PLASTIC_BRANCH_NEW_NAME%
echo PLASTIC_FULL_BRANCH_NEW_NAME %PLASTIC_FULL_BRANCH_NEW_NAME%
echo:
echo PLASTIC_BRANCH_NAME %PLASTIC_BRANCH_NAME%
echo PLASTIC_FULL_BRANCH_NAME %PLASTIC_FULL_BRANCH_NAME%
echo:
) >> %1
```

And then, when executing a rename in the branch, the result file would have the following content:

```console
# triggerresult.txt
PLASTIC_BRANCH_NEW_NAME = task002
PLASTIC_FULL_BRANCH_NEW_NAME = /main/task002

PLASTIC_BRANCH_NAME = task001
PLASTIC_FULL_BRANCH_NAME = /main/task001
```

As always, the usual environment variables are also available when running the trigger:

```console
PLASTIC_BRANCH_NAME
PLASTIC_FULL_BRANCH_NAME
PLASTIC_REPOSITORY_NAME
PLASTIC_COMMENT
PLASTIC_USER
PLASTIC_CLIENTMACHINE
PLASTIC_SERVER
```

### Bug

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Fixed exception deleting text in Merge Tool.

In some scenarios, selecting all the text and deleting it from the result TextEditor caused an IndexOutOfRange exception when using the merge tool. Now it's fixed.

***

## 11.0.16.7974

> **Note:**
>
> **Public** | 2023-05-11

### New

#### All platforms - Desktop GUI, Gluon

All platforms - Desktop GUI, Gluon: Preferences menu icons on hover

Changed the color of the menu item icon when the mouse is over the item.

#### Windows, Linux - Desktop GUI, Gluon

Windows, Linux - Desktop GUI, Gluon: Shortcut to open preferences dialog

Handled the "Ctrl+," keyboard shortcut to open the Preferences window in Windows and Linux.

#### All platforms - Desktop GUI, Gluon

All platforms - Desktop GUI, Gluon: Improve empty comment warning

We updated the dialog that appears when you try to check in some changes without entering a comment. Now the dialog has a check box that allows you to remove this warning for future check-ins. There's also a link to the view in the preferences where you can change this setting later.

Also, now the warning is also shown when creating shelves


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/8d09b2a31e59084490d348ac70c6986761779495984cf562677394cc232fc1c3.png)

#### Windows - PlasticFS

Windows - PlasticFS: Serveral improvements in symlink support

PlasticFS now uses its own reparse point solver. Now relative symlinks are allowed to freely reach the mount point and outside the workspace.

```text
$wk> mklink /D to_workspace .
symbolic link created for to_workspace <<===>> .

$wk> cd to_workspace

$wk\to_workspace> dir

04/12/2023  11:41 AM    <DIR>          .
04/12/2023  11:41 AM    <DIR>          ..
04/12/2023  11:41 AM    <SYMLINKD>     to_workspace [.]
```

Some additional corner cases involving junctions are now fixed too.

\== SYMLINKS LIMITATIONS ==

1. This feature is in an early stage of development, so you can expect minor bugs to happen.

2. PlasticFS always creates symlinks as files. By trying to access them, they will be automatically solved and converted to directories. However, this step might confuse external programs that do not expect it.

   * This happens anytime you create a new workspace or under some special conditions involving "undo" and "update" operations.

   * Windows Explorer will force this conversion, but you might have to refresh the window the first time it shows a symlink.

#### All platforms - Desktop GUI, Gluon

All platforms - Desktop GUI, Gluon: Standardize zoom controls

The image diff viewer zoom controls have been replaced by new ones with same look\&feel of the Branch Explorer zoom controls.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/0acdfefc115ff69b2f5c0bb9715ab202a598407d519f515b6b4f431eb11e9d81.png)

### Bug

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Fixed exception when closing Merge Window too quickly

Clicking "Save and Exit" on the Merge Window before the merge was calculated resulted in an unexpected error. We fixed this by disabling the button until the merge calculation completes.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Back button appears on user account change

The back button only has to be displayed when the Home view is visible for returning to the main workspace view.

***

## 11.0.16.7957

> **Note:**
>
> **Public** | 2023-04-27

### New

#### All platforms - All clients

All platforms - All clients: Faster workspace tree (plastic.wktree) update

Clients using super-huge trees (more than 1M items) will experience a performance improvement.

A single file checkout/checkin/undo operation in a workspace of 7M of items is now x10 times faster!

* Before, it took around 6 s to write the workspace tree.

* Now, it only takes 600 ms to write the workspace tree.

This change is only available for clients with the following client.conf setting enabled (see below):

```xml
<EnableNewWorkspaceTreeFormat>yes</EnableNewWorkspaceTreeFormat>
```

> **Note:**
>
> * Enabling this setting could cause trouble if there are older Unity DevOps Version Control installations (including older versions of the Unity Plugin) in the same machine. Be careful!
>
> * In this first step, this smart update is only enabled when there are not structural changes or xlink editions to write. We will improve this in the future.
>
> * This optimization is geared to workspaces with more than 1M of items, it won't be noticeable for smaller workspaces.

Details about the change:

Before, the entire workspace tree file was rewritten each time its metadata was modified (through a checkin, checkout, switch, etc. operation) even if only a few files were touched. Now it only re-writes the modified entries, which makes it much faster for big workspaces.

#### All platforms - Desktop GUI, Gluon

All platforms - Desktop GUI, Gluon: Added Attributes view for shelves

Now you can see and edit the attributes of a shelve when seeing its differences. There's a new button at the top that lets you open the list of attributes, from where you can add, remove or modify them.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/d6d05f5a82b62dbda12c9f58ddd9a2976bab9f91f61fe53256ccb7caa661518d.png)

#### All platforms - Desktop GUI

All platforms - Desktop GUI: "Close merge view and open pending changes" set by default

As of this release, "Close merge view and open pending changes" Preferences option will be set by default to all new users.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/c02fc3baadf1029c28d3c0e75bc4f155492360f0db5c21edbbd000db8140c52e.jpg)

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Code Review comments Reply button disabled after it's clicked

In code review window the Edit and Reply buttons has been disabled from comments and questions list while the new comment is in edition mode. This is done to avoid discarding the changed text when this button is clicked instead of the Comment button.

#### Linux -  Desktop GUI

Linux -  Desktop GUI: Updated app icon

As part of the ongoing rebranding to Unity Version Control, we replaced the 'Plastic SCM' icon with 'Unity DevOps Version Control' one in the app for the Linux platform.

#### Windows - Wwise plugin

Windows - Wwise plugin: Prompt for checkout on edit is now supported

Implemented support for the VCS setting "Prompt for checkout on edit", allowing users to checkout the affected files as part of the saving process.

#### Windows - PlasticFS

Windows - PlasticFS: Upgrade to WinFSP 2023

Plastic FS now uses WinFSP 2023 as the minimum supported version. If you already have WinFSP 2023 Beta 1, the upgrade process will be easier than ever.

You can find the WinFSP release notes in [https://github.com/winfsp/winfsp/releases](https://github.com/winfsp/winfsp/releases).

### Bug

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Issue tracker repo list is unsorted

In the Preferences window, the repositories list from Issue Trackers view will be sorted alphabetically.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Pending Changes - Selected items number not updating

Fixed text update in Pending changes tree, when the items were checked/unchecked the displayed category text wasn't updated properly.

#### All platforms - Desktop GUI, Gluon

All platforms - Desktop GUI, Gluon: Fixed misaligned links position

In the app, links and texts on the same line could appear vertically misaligned. We fixed this issue

#### All platforms - Desktop GUI

All platforms - Desktop GUI: After-checkin trigger errors now shown in GUI

Notifications about failures when running after-checkin triggers were being shown in the command line tools, but were not being shown in the GUI.

Now, we display the error in a dialog to ensure that you are alerted when a trigger fails to run.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Fixed null exception when resolving merge

We fixed an exception that could be thrown while processing file conflicts one at a time during a merge, where the merge involved writeable xlinks but there were no conflicts in files under the xlink. The exception didn't affect the merge, but the error dialogs made it look like there was a problem.

#### All platforms - Gluon

All platforms - Gluon: Details Panel showing incorrect characters under Spanish localization

Gluon Details Panel show incorrect characters in fields "Tamaño" and "Último acceso" in Spanish localization.

We fixed this issue.

***

## 11.0.16.7935

> **Note:**
>
> **Public** | 2023-04-20

### New

#### Windows - Desktop GUI

Windows - Desktop GUI: The legacy Plastic SCM GUI has been deprecated

Please update your installation to the latest version. Continuing to use any older version may result in reduced support for your operation.

The new GUI has been the default since version 11.0.16.7105 and is fully capable of upholding your Unity Version Control workflows, please don't hesitate to contact us to provide additional feedback so we can continue improving it.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: New design of the shelves view

We improved the design of the shelves view. The old table style was replaced with a new list that displays all the relevant information about each shelve in a cleaner way.

Also, we rearranged the buttons to create a new shelve and see the shelves list in the pending changes. Check it out:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/186a4bc035a78a1e4e9720c133ea5d744f8dbbe82c3fa5e620bad52686972a84.png)

#### All platforms - Desktop GUI, Gluon

All platforms - Desktop GUI, Gluon: Shelve diffs shown in the pending changes view

Now when showing the diff of a shelve, instead of opening it in a separate diff window, we show it integrated in the pending changes view. You can close the diff to go back to the pending changes or select a different shelve to view its differences.

We also redesigned the header of the diff window to match the new style of the shelve diff.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/c6502bba4bcf1ae72f21db6170724660225b599043153593b59a97464bf1c12d.png)

#### All platforms - Desktop GUI, Gluon

All platforms - Desktop GUI, Gluon: Added option to automatically open shelves

We added a new option in the Shelves view that, when enabled, allows you to automatically open the selected shelve in the current window, every time you change the selection. If you disable this feature, you can work as before, by double-clicking on each shelve to open the diff in a separate window.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/309fb9d734073de019e8f19f5a52a6ee2a782f3a2c90ac821fd0334985af48ef.png)

#### Windows - Desktop GUI

Windows - Desktop GUI: Enabled SemanticMerge by default

As of this release, the SemanticMerge tool will be the default tool for new Windows users instead of the legacy SemanticMerge tool.

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Enhanced Shelve view toolbar

Users will now see new "Apply" and "Delete" buttons in the toolbar, (and the previously existing context menu equivalent options). By prominently displaying these actions in the toolbar, we aim to improve the visibility and ease of use of these options for users.

#### All Platforms - Desktop GUI

All Platforms - Desktop GUI: Improve notifications

We replaced the old transient notifications in the status bar, with window notifications for a better experience.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/89e4ad58539b0e4d11f68f3692e0c25127feb90fdb4f732fac50773ead7b98df.gif)

#### Windows - Desktop GUI

Windows - Desktop GUI: Removed "Switch to Legacy GUI" menu option

The legacy Plastic GUI for Windows is no longer being supported as of this release.

In Unity VCS, the "Switch to Legacy GUI" menu option has been removed, and the executable will soon no longer be part of the installation package.

Also, "Welcome to new GUI" message panels were removed


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/ab5babd6d77062b5c175779b06f93eccfdf87b7308e114ad4ddbb0f9f38461ea.jpg)

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Updated 'Sign in' dialog layout

We updated the 'Sign in' dialog in order to highlight the Unity ID auth because now it is the main one.

### Bug

#### All platforms - All clients

All platforms - All clients: Fixed an error that could result in corrupted downloads because of a socket timeout when using SSL

Under some circumstances, downloading revision data from the UVCS server to the disk - typically a workspace update operation - might fail, leaving partial content on the disk (files not completely downloaded, or not downloaded at all).

The message error you would see in this situation is:

```text
Received an unexpected EOF or 0 bytes from the transport stream
```

Now there is a higher timeout in place both for send and receive operations, which reduced timeouts by more than a 90%. This results in fewer retries overall for every user, and fewer chances of facing this error, even without updating your client version. Nevertheless, we encourage you to also update your client to this version, as now it is properly detecting unexpected EOF's at SSL to retry the operation automatically.

#### All platforms - Desktop GUI, Command line client

All platforms - Desktop GUI, Command line client: Allow complete a merge keeping the local changes with the files locked

Previously, the merge operation needed to access all the files in conflict, no matter the selected resolution for those files.

Now, when you want to keep your local changes during the merge (keep destination resolution), this access is not needed.

It is useful when your IDE locks the file you are working on and for which you want to keep your changes, such as an asset of the Unreal Engine.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Fixed exception when navigating to "Find in files" result in large file

In some circumstances, navigating to a "Find in files" result after previously selecting a file large enough to show the "large file" warning, could result in an error being shown. We fixed that.

#### All platforms - Desktop GUI

All platforms - Desktop GUI: Fixed branch explorer multilabel issues

An error was obtained when double clicking a multilabel shape in the branch explorer, now the browse repository view will be displayed after this user action. The displayed properties from the Options panel were not consistent with the current selection when a multilabel was selected, now no Properties will be displayed for this kind of labels.

An issue has also been fixed regarding the branch explorer view, when the browse repository view was closed the branch explorer was not in normal mode because it had the panning mode activated.

#### All platforms - Command line client

All platforms - Command line client: Fix client configuration for Unity ID authentication

The cm configure command was wrongly setting the LDAP working mode, when configuring your client to work directly against the cloud server using the Unity ID authentication.

As a result of this misconfiguration, when you try to access a different server, which was not used before (without a profile for it), the client fails with the error "Invalid parameters for LDAP in client config file."

Now the cm configure command sets the right SSO working mode. Also, when the misconfiguration is detected is fixed automatically without having to configure the client again.

#### All Platforms - TeamCity plugin

All Platforms - TeamCity plugin: Added a timeout so now plugin is able to reset if it hangs up on the shell initialization

Plugin was some times getting stuck on cm shell version command for some Agent operations. We added a timeout for those operations and now if it hangs we are able to get rid of it and fail.

#### All platforms - Server

All platforms - Server: TrunkBot Mergebot (DevOps) was throwing an error on a race condition

It could happen that the TrunkBot is about to start processing a branch from its queue, but at the same time an attribute change of that branch could cause the deletion of the same branch from the queue, causing an internal exception that stopped the process and prevented the branch to be processed. Fixed.

***

## 11.0.16.7881

> **Note:**
>
> **Public** | 2023-04-03

### New

#### All Platforms - Unity DevOps Version Control

All Platforms - Unity DevOps Version Control: Organization creation redirect.

Previously, it was possible to create organizations directly from the GUI, but now, organization creation has been moved to the Unity Dashboard.

So when you try to create a new organization from the GUI, you'll now be redirected to the Unity Dashboard.

#### All platforms - Plastic, Gluon

All platforms - Plastic, Gluon: New Code Editor and Language settings in Preferences

A new settings tab has been added to Preferences window to allow Code editor settings management. In this new view we can modify some of the settings related to the code editor as the font or number of tab spaces, and also the values can be restored from the default configured values.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/0d6d189a2f4fa93351367aec43efa33c1744910558914d43301c1f407a520da1.png)

The app language selection has been also added to the Other options view from Preferences window. When a new language selection is done and saved, a new popup message will be displayed asking for the application restart. The new language will be applied in GUI only if the application is restarted.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/9155699f571ca101e0a58dc921f962e4201a4a06fcbf0b7424f162c575dc42c7.gif)

#### All platforms - Unity DevOps Version Control

All platforms - Unity DevOps Version Control: Updated app icons

As part of the ongoing rebranding, "Plastic SCM" icons were replaced by "Unity DevOps Version Control" icons in the app.

### Bug

#### All Platforms - Unity DevOps Version Control

All Platforms - Unity DevOps Version Control: "Checkin" grammar revision

"Checkin" grammar revision was made in all text strings.

For instance, the "Checkin" button was changed to "Check in" in the Pending Changes View.

#### All platforms - Unity DevOps Version Control

All platforms - Unity DevOps Version Control: fixed exceptions in Home view when user has no organization

We fixed a couple of issues in the Home view where exceptions were thrown when the user has no organization. The exceptions were thrown when the show deleted repositories option was toggled, and when text was entered in the filter.

#### All platforms - Unity DevOps Version Control

All platforms - Unity DevOps Version Control: Localization broken

Fixed the loading of localized texts into the GUI.

***

## 11.0.16.7851

> **Note:**
>
> **Public** | 2023-03-23

### New

#### All Platforms - Unity DevOps Version Control

All Platforms - Unity DevOps Version Control: Color Picker: Removed alpha channel slider

In this release, alpha channel slider was removed for Color Picker controls


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/e8dc9079a26745fe2e629811a4f892097a9fe33e722b7e7978738985e33ef349.jpg)

#### Server

Server: Allow to see the branch changes pending to integrate when it doesn't fulfill the merge rules.

The diff --integration (e.g., 'cm diff br:/main/task --integration') allow to see the pending changes to integrate for the given branch. But, when the branch doesn't fulfill the merge rules defined on the server (e.g., you need to review the branches prior to merge them into /main), you get the error "Cannot perform the merge because of the Merge Rules. Review the branch '/main/task' to merge it to '/main'." when you try to see the changes pending to integrate on a branch without a code review.

Now the diff --integration works, no matter if the server has any merge rule enabled or if the branch fulfill those rules.

#### All platforms - Unity DevOps Version Control, Gluon

All platforms - Unity DevOps Version Control, Gluon: Improve visibility of current changeset or branch

We added some visual cues to the Branches and Changesets view so that you can more easily see which is your current branch or changeset.

We also applied the same style change to the item history view in Gluon.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/19451bd9e802924abf4c1ef88726fdaac91955e458ae3166a37dd5243bd7abeb.png)


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/e9f97af469447bcdf59a38a36f0216baafd98265c0670d338ea0a9b7dac7965d.png)

#### All platforms - Unity DevOps Version Control, Gluon

All platforms - Unity DevOps Version Control, Gluon: Highlight path changes for moved items

We added highlighting to the paths for moved items so that you can more easily see which parts of the path were changed.

This applies to the Pending Changes, Merge, Diff and Incoming Changes views in Unity DevOps Version Control and Gluon.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/2c70a297c30f351d44272eb718b4555419298f4ab5ddc9ea8420e2b624f62808.png)

#### All platforms - Unity DevOps Version Control

All platforms - Unity DevOps Version Control: Notification added to invite users to try the new Code Review experience.

We have added a notification bar that invites users to try out our enhanced Code Review experience from the [Unity Dashboard](https://dashboard.unity3d.com/devops/organizations/default/plastic-scm/organizations):


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/ed932e508437ae13311c0e847fc88062b35fda4c8b62ced26ffb0342f47db3fc.png)

#### All platforms - Command line client

All platforms - Command line client: Revamped the client configuration from the command line.

We improved the way of configuring the client interactively from the command line client (`cm configure`).

The first change is that now you are not asked for the repository server specification in different steps. Take this as an example - this is what you had to do before to configure a SSL server:

```text
Configure the Unity VCS server address/port:
Unity VCS server address [localhost]: version-control.unity-hq.domain
Unity VCS server port [8087]: 8087
Use encryption (SSL)? [y/N]: y
Unity VCS SSL server port [8088]: 9095
```

You had to specify a plain TCP port despite the server might not be even listening on one. Then you were asked whether or not you wanted to use SSL, and only then you could specify the port you really wanted to use. This process was both slow and error prone.

This is what you need to do now to achieve the same:

```text
Enter server address: ssl://version-control.unity-hq.domain:9095
```

Additionally, if your server requires connection credentials (User and password, or email and password), the command line client checks that the credentials are correct before saving any configuration - letting you retry if you fail to type in your user or password.

And last but not least the `cm configure` command now supports configuring your client directly against a Cloud organization  (using email and password, Unity ID, or any other Single Sign-On mechanism you might have configured). Before these changes, only email and password were allowed for configuring your client directly against the Unity DevOps Version Control Cloud servers.

#### Windows - Wwise plugin

Windows - Wwise plugin: New location for the Wwise plugin

From this version on, the Wwise plugin compatible with version 2021 and below can be found in the PlasticSCM installation folder, under the path "client/plugins/wwise".

#### Windows - Wwise plugin

Windows - Wwise plugin: New plugin for Wwise 2022

We are pleased to announce the first release of the Unity DevOps Version Control Plugin for Wwise compatible with version 2022.

This new plugin can be found in the PlasticSCM installation folder, under the path "client/plugins/wwise2022".

#### Command-line client

Command-line client: Update command improved for automation

Now moved files will be also regarded when option --xml is specified. On top of that, a new field "ChangeType" has been added in order to make the output more understandable and easier to parse. For instance, if we are 1 changeset behind the head and within the last changeset we renamed a file "math.c" to "stats.c" and moved "dice6Tex01.png" into "textures" folder, then we changed the content of dice6Tex01.png. When updating the workspace to the head, we could see something similar to the following:

```console
$ cm update . --xml 2>update_errors.txt
<?xml version="1.0" encoding="Codepage - 437"?>
<UpdatedItems>
  <List>
    <UpdatedItem>
      <Path>c:\wkspaces\BestGameEver\stats.c</Path>
      <User>john.scott</User>
      <Changeset>7</Changeset>
      <Date>2023-01-12T15:30:39+01:00</Date>
      <OldPath>c:\wkspaces\BestGameEver\math.c</OldPath>
      <ChangeType>Moved</ChangeType>
    </UpdatedItem>
    <UpdatedItem>
      <Path>c:\wkspaces\BestGameEver\textures\dice6Tex01.png</Path>
      <User>john.scott</User>
      <Changeset>7</Changeset>
      <Date>2023-01-12T15:30:39+01:00</Date>
      <OldPath>c:\wkspaces\BestGameEver\dice6Tex01.png</OldPath>
      <ChangeType>Moved</ChangeType>
    </UpdatedItem>
    <UpdatedItem>
      <Path>c:\wkspaces\BestGameEver\textures\dice6Tex01.png</Path>
      <User>john.scott</User>
      <Changeset>7</Changeset>
      <Date>2023-01-12T15:32:12+01:00</Date>
      <ChangeType>Changed</ChangeType>
    </UpdatedItem>
  </List>
</UpdatedItems>
CommandResult 0
```

See --usage for details:

```console
> cm update --usage
```

Special considerations:

* Have in mind that every operation performed on an item will appear as different UpdatedItem nodes. As seen in the previous example, the file "dice6Tex01.png" is both relocated and changed in the same changeset, so it appears twice (one per operation) in the XML output.

* If a controlled file has been deleted and added again with the same name (either with the same or different content), it will be reported both as a delete and an add operations. This is, the item will appear twice in the report, the same as it works in other commands such as 'cm partial update'. Before this code change, when the content of the file was identical, the file was not reported at all. When the content of the file was different, it was only reported as a change.

* If a file has the exact content of the revision we are updating it to (i.e. for revision X and revision Y the content of the file is "hello", and we are updating the file from revision X to revision Y), it is reported as a changed item. Before this code change the file was not reported as changed because Unity DevOps Version Control didn't need to download data from the repository server (the hashes from both revisions match).

### Bug

#### Server

Server: Configure generates server.conf in one line

Breaking changes in the underlying .NET serialization library were removing indentation from the configuration file.

[https://github.com/dotnet/runtime/issues/64885](https://github.com/dotnet/runtime/issues/64885)

A different approach was used to avoid the issue.

#### All platforms - Gluon

All platforms - Gluon: Fixed error when workspace was on a label

If you switch your workspace to a label on Unity DevOps Version Control and then try to convert it to a partial workspace to work on it from Gluon, we were showing an error and the workspace couldn't be updated. We fixed this issue, and now you can convert the workspace to partial and vice-versa without issues

#### All platforms - Unity DevOps Version Control

All platforms - Unity DevOps Version Control: Eliminated file not found error launching diff from visual diff

When launching a method diff from the visual diff panel a "file not found" error would be shown. There was no actual error, and the diff would be shown correctly. We stopped that erroneous error from appearing.

#### All platforms - Unity DevOps Version Control, Gluon

All platforms - Unity DevOps Version Control, Gluon: Improved the way we classify files with unknown extensions

When adding new items from the Pending Changes view, if the extension is not one of the well-known extensions for text or binary files, we were always classifying the new files as binary. We improved this behavior, and now when the extension is unknown, we will check the contents of the file to determine if it should be classified as binary or text

***

## 11.0.16.7832

> **Note:**
>
> **Public** | 2023-03-16

### New

#### All platforms - semantic merge

All platforms - semantic merge: Moved buttons to options menu

We moved the "Visual merge", "Run text merge" and "Restart merge" buttons to the options menu


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/dbd384a798fa2b78039dfc00d445d05430ea6a120453f3b06da91620e1a877c1.png)

#### All platforms - Unity Version Control

All platforms - Unity Version Control: Improved the Search Panel for the source code editors:

* Users can now use the Replace functionality if the editor is writable.

* Search queries now support Match Case, Match Whole Word, and Regular Expressions.

* A tag has been added to inform users if matches have been found and to display their current match index out of the total number of matches.

* The total number of matches found is also displayed.

* The search result colors have been improved for both light and dark themes.

Some demo:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/08f208d895a4a651e9c2d287f89d86790a337c9772e4d56b91f7a4c104bf3587.gif)

#### All platforms - Unity Version Control

All platforms - Unity Version Control: Ported configuration dialog to semantic merge

A Configuration dialog has be ported to the new semantic merge, it is accessible from options menu, and contains preferences and configuration options pertaining to semantic merge.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/4568e3b3a9e65762cae42641dc01ebaf1de48d521ad3fe9cc431c9b123da592e.png)

#### All platforms - semantic merge

All platforms - semantic merge: Added options menu

We have stated populating the options menu in the semantic merge window. So far it looks like this


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/c9f4a79958df5e59c1ce54e7f743b8ca10ba2166e069c1c71bf19fc34330c316.png)

#### All platforms - semantic merge

All platforms - semantic merge: added Explain Move button

We added an "Explain move" button for move conflicts to the semantic merge outline panel here


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/0ff6720a7dddf9203150d0077b4134684407833b8e67a21f66aec86eba2e2eb5.png)

.

Clicking it opens up a visual depiction of the move.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/c01fec864ecf88e6d0caa7942aff87f8521a9d64ea58fef9cf189978595c2ea3.png)

#### All platforms - Unity Version Control

All platforms - Unity Version Control: Renamed "DevOps user profile" preferences tab

We have renamed the "DevOps user profile" tab in Preferences to "Mergebots".

#### All platforms - Unity Version Control

All platforms - Unity Version Control: Removed Plastic SCM logo

As part of the ongoing rebrand to Unity Version Control we have removed the Plastic SCM logo.

#### All platforms - Unity Version Control, Gluon

All platforms - Unity Version Control, Gluon: New options context menu

The options context menu navigation and look\&feel has been improved.

* The items from the menu have been rearranged.

* The margins between icons and texts have been adjusted.

* New options have been added: Documentation, Unity Version Control Web UI (just for Cloud edition)

* Simplified the theme selection.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/6fc04d24a6a56269243f2646d7308969f52228a94daf9a20a75464026898bdbb.png)

#### All platforms - Unity Version Control, Gluon

All platforms - Unity Version Control, Gluon: Modify the sign-up process to redirect users to Unity DevOps purchase flow.

We removed the ability to sign up for Plastic SCM credentials and redirect users to the checkout page for Unity DevOps. When landing on this page, they'll be invited them to create a UnityID first. Once this is done, they can continue the purchase on the checkout page.

#### Windows - Unity Version Control

Windows - Unity Version Control: Rename Start Menu shortcuts

As part of the ongoing rebrand to Unity Version Control, Plastic SCM shortcuts in Start Menu have been renamed.

Also, a new shortcut was added in this menu: "Unity DevOps Version Control"

### Bug

#### All platforms - Unity Version Control

All platforms - Unity Version Control: Fixed a crash restoring diffs in the diff viewer.

Previously, restoring a diff with search results focused in the right text editor could cause the GUI to crash. We have fixed this issue so that it no longer occurs.

#### All Platforms - Unity Version Control

All Platforms - Unity Version Control: Fixed Encoding comparison issue

Sometimes we faced wrong results performing the encoding comparison. Now it's fixed.

#### All Platforms - Unity Version Control

All Platforms - Unity Version Control: Inconsistent Display of Encoding Differences

The display of encoding differences has been updated to consider the "effective" encoding.

If the left contributor is detected as UTF-8 and the right encoding is detected as NONE, but the system encoding is also UTF-8, the encoding differences will not be shown.

The BOM will also be considered when displaying encoding differences.

These changes will improve the accuracy of encoding detection and the display of encoding differences.

#### Windows, Linux - Unity Version Control, Gluon

Windows, Linux - Unity Version Control, Gluon: Fixed 'Open With' operation if the path contains whitespaces

The 'Open With' operation failed if the item path contains whitespaces, preventing the item from being opened.

We fixed this issue.

***

## 11.0.16.7806

> **Note:**
>
> **Public** | 2023-03-06

### New

#### All platforms

All platforms: Plastic SCM is now Unity Version Control


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/32d86a6ba62f35245c23e801117bb39bc88ad37ae4a7ca33e2c5c970658bc6dc.png)

Plastic SCM is now rebranded as Unity Version Control.

We have also updated our end-user license agreement (EULA). You will find it in the installer.

#### All platforms - SemanticMerge

All platforms - SemanticMerge: UI improvements.

Added a UI refresh for the semantic merge tool. These are the main points:

* Use camel case for buttons and labels.

* Moved the "Process al merges" button to the conflicts header.

* Improve each conflict resolution text readability.

* Use buttons instead links for match/unmatch actions.

* Fixed the encoding string in the contributor headers.

* Unify some margins and paddings.

#### All platforms - Plastic

All platforms - Plastic: Undo checkouts options

Added a new option in the pending changes view that lets you undo the checked-out files while keeping the local changes. This is the same as using the --keepchanges option when executing the cm undo command.

We also reorganized the buttons in the pending changes view.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/478223f7cd0c42dc5c365c457cbf81bb5341450da5e26794cc9a6a2639bfcc80.png)

#### All platforms - Plastic

All platforms - Plastic: Removed the license expires soon reminder for non-trial licenses.

We removed the license expires soon reminder for all non-trial license users to avoid disturbing users who have monthly subscriptions.

The license notification will still appear for those users when their license fully expires.

This notification panel doesn't appear anymore in the app:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/01299c979b24260b214c4249a99880ea784425663185eb997cbc27878c289138.jpg)

### Bug

#### All Platforms - SemanticMerge

All Platforms - SemanticMerge: Fixed wrong content for resolved conflicts.

When resolving a manual conflict, if the merge resolution text was exactly the same as the base contributor text, it caused the semantic merge tool to wrongly choose the destination text for the result. Now it's fixed.

#### All platforms - Plastic

All platforms - Plastic: Fixed null exception using Find in files in Plastic Link.

When you use Find in files in a Diff or Code Review Plastic Link, a null exception is thrown.

We fixed this issue.

***

## 11.0.16.7792

> **Note:**
>
> **Public** | 2023-02-23

### New

#### All platforms - Plastic

All platforms - Plastic: Semantic diff viewer.

Launching semantic merge as a standalone tool displayed the text-based differences. Now the semantic-based differences are displayed.

You can try executing the semantic merge standalone tool:

```text
plastic semanticmerge
-s="<path-to-src-file>.cs"
-d="<path-to-dst-file>.cs"
```

#### All Platforms - Plastic

All Platforms - Plastic: Add codepage encodings to the encoding menu.

* We've added all the available codepage encodings to the Encoding dialog.

* The encoding list now shows EncodingName, WebName, and CodePage for easy identification.

See it in action!


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/9c261eb578d21c9fcc363411f20d09cec6a049e9285dfa8c5e5d9b3dec0f2a71.gif)

#### All platforms - Plastic, Gluon

All platforms - Plastic, Gluon: Find in files feature added to diff window

You can now do a text search in all files in a diff or code review.

Just press the "Find in files" button to open the Find in files dialog.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/7e2839c205ba48076cea0a1204523372261f44893e20cbe00fe8ea5d9b768326.png)

You can choose if the search is case sensitive. You can also choose to search only the source, or destination contributor. You can choose to search all files in the diff, just currently filtered files, or just the currently selected file. Also, you can filter the results by file extension.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/4b9d7b61a279f6c180c7afceb8a81ef2c5347d5612c5d4bd6265be989dd8d819.png)

Search results will appear at the bottom of the window.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/361bea6734b2a9fae2129f93413262206af98773290ca920403b8eb237bff792.png)

Selecting a result will open the relevant file and show the matching line.

### Bug

#### All Platforms - Plastic

All Platforms - Plastic: Fixed an encoding issue in merge.

For a file that was encoded as UTF8 but contained invalid bytes, the merge process could raise the following error:

```text
Unable to translate bytes [XX] at index YYY from specified code page to Unicode.
```

Now it's fixed.

#### All platforms - Plastic

All platforms - Plastic: Fixed 'Label all writable xlinked repositories' option

There was an issue with 'Label all writable xlinked repositories' option for the 'label this changeset' dialog, the app always created the label in the xlinked repositories too. We fixed this issue.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/0dc3315b2ef001b3341b35ca5727bb5bee6be625d14c687ab18056a56b351bc0.jpg)

***

## 11.0.16.7778

> **Note:**
>
> **Public** | 2023-02-16

### New

#### All platforms - Plastic

All platforms - Plastic: Added Visual Diff button to Semantic Merge

The "visual diff" button has been added to allow viewing the differences in a "visual" way, it's accessible via the outline panels on semantic merge.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/dff94c57e93d1e77903deacdcefe5ac80c9b42a66c8fb9e1e341bc7831fa5431.png)

#### All platforms - Plastic

All platforms - Plastic: SemanticMerge parsing error dialog

Added a new functionality to display any parsing error that semantic merge has detected.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/3b50bfe1cfac57d44daea24d68593d1b26c43b1afe4ef49fe1f9f6e143c31d35.png)

#### P4/Git importers

P4/Git importers: From now on, running import operations is restricted to users with the change owner permission

The Plastic import operation sets the original P4/Git objects author to keep the repository history intact.

Creating branches, labels, revisions... as a different user is something the importer, under an account with change owner permission, should do to reduce the risk of impersonating objects.

If you have a periodic sync operation ongoing, please make sure that the user running the "cm" command has the change owner permission enabled for the repository

#### All platforms - Plastic

All platforms - Plastic: Added Restart Merge and Run Text Merge buttons to Semantic Merge

A new set to buttons is now available on semantic merge, "Restart Merge", and "Run Text Merge".


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/83342cc552c2266d99b88fc89c60449c2403a8349a5f6ebe833181b751c58ec1.png)

#### Server

Server: More resilient check-in to out-of-date workspace due to cloaked

Now the check-in operation returns a meaningful error when you try to check in an out-of-date item that is no longer loaded on the server:

```text
The item '/l_memory.h' is not loaded on the changeset you are working on (cs:5).
Most likely, you updated the workspace with the item cloaked, so it wasn't unloaded.
Please retry the check-in operation excluding this item, then update the entire workspace to fix any inconsistency.
```

This problem can happen when you remove the cloaked rules for an item, this item remains out of date, and you modify it. See an example:

* James - Cloak `/code` directory

* Mary - Delete `/code` & check in the change

* James - Update his workspace

* James - Uncloak the `/code` directory

* James - Move `/code/botlib/l_memory.h` to `/l_memory.h`

* James - Delete '/code'

* James - The check-in will fail with the error above because `/l_memory.h` no longer exists on the repository.

#### All platforms - Plastic, Gluon

All platforms - Plastic, Gluon: Added conflict resolution text label in Semantic Merge

We have added a new text label in Semantic Merge. This label will inform the users of resolved conflict status


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/e5b417ee466d038820de49eaa2fb68bbcaf634fe0d5f61b452b7e1d23e7b5337.jpg)

#### All platforms - Plastic

All platforms - Plastic: New "Show pending to integrate" option for branch diffs

We added a new option in the diff window for branches, that lets you see the branch changes pending to integrate into its parent branch. This is the same as using the recently added --integration option in the cm diff command.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/10521ae48cf5f067dbb57dd8e96cd266cc8e9b383305b3443d1b6574bb958d98.png)

### Bug

#### All Platforms - Plastic

All Platforms - Plastic: Fixed wrong color of Semantic Merge on dark themes

When launching Semantic Merge via command line and using a dark theme, the color combination of a highlighted section that contains a code comment would make the section unreadable, this has now been fixed.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/a1f7cac4a02fc976cf7eaec90620eee16f6dc4baf37662d9c97f34ea1983b818.png)

#### All Platforms - GitServer

All Platforms - GitServer: Failure running 'git pull' using HTTP protocol.

After certain repository size, the 'git pull' operations could fail with the 'fatal: protocol error: bad pack header' error. This happened only when using the http\:// protocol.

The Plastic GitServer was implemented long time ago and it doesn't support the `multi_ack_detailed` & `no-done` capabilities that most Git clients do. So, we rely in the original protocol without these extra capabilities leading to some weird behavior in some cases. This will be improved in the future.

With the fix done, the `git pull` operation will download the Git package  (and it will not fail anymore like it did), but, sometimes, it will not update the local references. Thus, an extra `git pull` command execution could be needed to upload the repository references (that will download nothing).

```console
git pull
remote: Exporting changeset cs: ... (1/118)
Receiving objects: 100% (354/354), 79.23 KiB | 3.30 MiB/s, done.
```

```console
git pull
From http://server/repo
   47a2ee4..ffe577f  master     -> origin/master
   0cce4d8..3184425  task       -> origin/task
Updating 47a2ee4..ffe577f
Fast-forward
 foo.c | 2 ++
 1 file changed, 2 insertions(+)
```

#### All Platforms - GitServer

All Platforms - GitServer: HTTP server thread crashed with unexpected error.

The thread used to serve the GitServer HTTP requests could crash if there was any unexpected exception when closing the client HTTP connections. Now this error is fixed.

***

## 11.0.16.7762

> **Note:**
>
> **Public** | 2023-02-09

### New

#### Server

Server: Make check-in more robust to client errors

Added protection to the check-in operation to prevent a not uploaded file ends stored on the repository with a wrong revision.

#### All platforms - PlasticX

All platforms - PlasticX: Cloud Repositories view removed

We removed Cloud Repositories view from Plastic because this functionality is now available through the Home view.

Also, we added the "Create new sync view (push/pull)" context menu option, which was missing, in the Home view.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/b2c4017e78c5cec303e460733b8f805df9225f017a9e8e5f4027f31b490ff7fa.jpg)

### Bug

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Protect the delete repo operation when a workspace is in use

We protected the delete repository operation to take into account if there is a workspace in use that points to it. In this way, we prevent error messages due to the missing repository for the current workspace.

The app now shows a message to notify you about this scenario:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/f1dc2502abd2e3ec81b242f7f86b182ce73dfb1aa3c1a229464367c02f3e1b5f.jpg)

***

## 11.0.16.7754

> **Note:**
>
> **Public** | 2023-02-02

### New

#### macOS, Linux - Plastic

macOS, Linux - Plastic: New binary merge tool configured by default

Now the binary merge tool is set as the default tool to fix binary conflicts on macOS and Linux. So when you try to diff or merge a binary file, like an image, the new tool will be used

#### Windows - Gluon

Windows - Gluon: Removed legacy Gluon GUI from the installer

The "legacygluon.exe" won't be available anymore. Use "gluon.exe" instead if you aren't already!

This release marks the end of support for the legacy Gluon GUI for Windows.

#### All platforms - Plastic

All platforms - Plastic: Shelveset merge summary updates when toggling items

When applying a shelveset to your workspace you can use the checkboxes to choose which changes to take from the shelveset. We now update the summary at the top of the view according to the selected changes.

Here is an example:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/600be5cc6e27408a4c488ed2187c13658f28088d0de51f2d54e0f07706b4dbd6.png)

#### macOS, Linux - Plastic

macOS, Linux - Plastic: New semantic merge tool configured by default

Now the semantic merge tool is set as the default tool to fix semantic conflicts on macOS and Linux. So when you try to diff or merge a semantic file (C#, VisualBasic or Java), the new tool will be used.

#### Command-line client

Command-line client: ACL commands warn about objects without ACL

Updated the help of the ACL command to remove those objects without an ACL. Also, the ACL command warns about those objects that are invalid.

#### Windows - PlasticX, GluonX

Windows - PlasticX, GluonX: Updated Avalonia version

In this release we've updated Avalonia, our cross-platform UI framework

This update addresses an issue that affects dialogs for Windows users (showing a message dialog after a dialog could throw a null exception).

#### PlasticFS

PlasticFS: The executable is signed from now on

Previous versions of Plastic contained an unsigned version of PlasticFS. In some places, restrictions apply over unsigned executables rendering PlasticFS unusable.

Now they are signed to overcome this limitation and make it easier to use.

### Bug

#### All platforms - Plastic

All platforms - Plastic: Binary merge, can't close error message

An issue has been fixed which prevented an error message, due to invalid arguments, from being closed.

#### Windows - Plastic

Windows - Plastic: Fixed null exception in Merge Options Dialog

In Merge View, a null reference exception appeared when you saved the merge options in Merge Options Dialog with at least one solved directory conflict, not allowing the user to cancel or recalculate the merge. We fixed this issue and now it works correctly.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/1e8720f3e978673cc4f1171b9629a8eb82309711d9a67e75ceffb1cc7b262889.png)

#### All platforms - Plastic

All platforms - Plastic: Optimized refresh operation after saving Merge Options

In Merge View, after saving Merge Options, merge view was always refreshed.

In this release, we only refresh the view when a merge recalculation is needed.

#### macOS - Plastic

macOS - Plastic: Fixed tool config for server-side merge operation

In the previous release we had an issue with the server-side merge operation, where the merge tool that appeared in the default configuration couldn't be launched for text conflicts on macOS.

We fixed this issue, and now you don't need to apply any workaround to fix text conflicts in server side merges.

***

## 11.0.16.7739

> **Note:**
>
> **Public** | 2023-01-26

### New

#### All Platforms - Gluon/GluonX

All Platforms - Gluon/GluonX: Incoming Changes only checks-out local changes involved in conflicts.

Before, the Incoming Changes applied all the local changes in the workspace before running the operation. It didn't matter whether these local changes were in conflict with the changes to update/merge or not.

This could end up locking exclusively some files that were only locally modified (unrelated to update operation) and preventing other users to modify those files due to an undesired lock.

Now, only the local changes that are in conflict with the server changes to update/merge are applied in the workspace.

#### Command-line client

Command-line client: Partial update command improved for automation

Several adjustments have been made to the partial update command:

* There was no `--xml` option in the partial update command. Now it is available.

* `--xml` option can be used in a pipeline.

* Using the `--xml` option implies `--silent`. Informative output gets trimmed.

* Using the `--silent` option removes informative output only. Warning and error messages are still written through standard error output. You can silence those messages by using output redirection.

#### All platforms - Plastic

All platforms - Plastic: Diff images available for binmerge tool

Now you can specify two arguments to the "plasticgui binmerge" command, the source and the destination contributors, to diff them instead of performing a merge. Both files must be images:

```text
plasticgui binmerge -s=source.png -d=destination.png
```

#### All Platforms - Plastic

All Platforms - Plastic: SemanticMerge match/unmatch

Ported match/unmatch functionality to new GUI for SemanticMerge.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/d3f4ea396361a07cf0f640a003d1193058a8d40835fb383e10b20829a30c056e.gif)

### Bug

#### All platforms - Plastic

All platforms - Plastic: Fixed issue applying directory conflict resolutions from shelveset

When applying the changes in a shelveset you can choose which of the changes you wish to apply. There was a bug which meant that if you chose to apply only resolved directory conflicts you would be told that no changes were selected and you would not be able to apply those changes. We fixed this, so now you can apply your directory conflict resolutions without issue.

#### All platforms - Plastic

All platforms - Plastic: App hang on closing if Pending Changes View is refresing

Plastic didn't respond if the user closed the GUI or switched to another Workspace when Pending Changes View was running a "finding changes in the workspace" operation.

This issue is now fixed.

***

## 11.0.16.7726

> **Note:**
>
> **Public** | 2023-01-19

### New

#### All platforms - Command-line client

All platforms - Command-line client: Flag to print just the root spec

Now the shelve creation is able to print just the shelveset spec of the root repository, skipping other "xlinked" shelvesets created this way. This is useful for automation purposes.

Example:

```console
$ cm shelve --all --summaryformat
sh:64@tools_repo@plastic_server:8087
```

#### All platforms - DevOps

All platforms - DevOps: Trunkbot now also sends trunk branch in a property

The trunkbot now also sends the configured trunk branch (usually the /main branch) to the underlying Continuous Integration system in a property named `PLASTICSCM_MERGEBOT_TRUNK_NAME`.

#### Windows - Gluon

Windows - Gluon: Removed "Switch to Legacy GUI" menu option

This release marks the end of support for the legacy Gluon GUI for Windows.

We removed the "Switch to Legacy GUI" menu option in Gluon, and soon the executable won't be included in the install package.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/a11fac099dd20e5e7aed0eb4bb9397d5b942a42cae9c05500b784d1fd860f9d0.png)

#### All platforms - Plastic

All platforms - Plastic: Unified the style of the color pickers

We unified the style of all color pickers that are shown in the application. This is how they look now:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/69ea384824a0b7e4b316224a307e0b524fa145ad54dfedd03d0bb2781d69d82d.png)

#### Linux - Plastic

Linux - Plastic: Allow changing the editor font.

For Windows and macOS you could change the font of the diff/merge:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/aa03edb1cb0ecba6c1e3af938976c68ab57440e654efe21122566cfbbc30a2ae.gif)

Now you can also do it on Linux

#### All platforms - Plastic

All platforms - Plastic: Unified the look of the overlapped views

Sometimes when opening a view that requires all the space in the window, we open it on top of the current view. Overlapped views show a header at the top, that you can also use to close the view go back to the previous one.

We unified the style of these headers, and now all overlapped views in the application have the same look.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/3b5bff7438f0a021483a4eb07b095782849250c0b12df7fe43ef1ce95b0ed192.png)

#### MacOS - Plastic

MacOS - Plastic: Update default merge tool

We updated the merge tool that is used by default to solve file merge conflicts. Now, unless you change it manually, the name of the new cross-platform merge tool will be used, instead of the legacy platform-specific one

#### Command-line client

Command-line client: Merge command improved for automation

Several options have been added, mirroring the update command: --xml and --encoding:

```console
$ cm merge /main/task1001229 --xml --encoding=utf-8 2>nul
<?xml version="1.0" encoding="ibm850"?>
<Merge>
  <Added>
    <MergeItem>
      <ItemType>Xlink</ItemType>
      <Path>/Assets</Path>
      <Spec>
        <Server>localhost:8084</Server>
        <Name>ArtAssets</Name>
      </Spec>
    </MergeItem>
    <MergeItem>
      <ItemType>Dir</ItemType>
      <Path>/Source</Path>
      <User>tim</User>
      <Date>2022-12-15T11:46:46+01:00</Date>
    </MergeItem>
    <MergeItem>
      <ItemType>File</ItemType>
      <Path>/README.md</Path>
      <Size>6</Size>
      <User>tim</User>
      <Date>2022-12-15T11:46:46+01:00</Date>
    </MergeItem>
    <MergeItem>
      <ItemType>File</ItemType>
      <Path>/Assets/guy.brush</Path>
      <Size>17</Size>
      <User>tim</User>
      <Date>2022-12-15T11:46:46+01:00</Date>
    </MergeItem>
  </Added>
  <Deleted>
    <MergeItem>
      <ItemType>File</ItemType>
      <Path>/README.txt</Path>
      <Size>9</Size>
      <User>tim</User>
      <Date>2022-12-15T11:46:46+01:00</Date>
    </MergeItem>
  </Deleted>
  <Changed>
    <MergeItem>
      <ItemType>File</ItemType>
      <Path>/LICENSE.txt</Path>
      <Size>39</Size>
      <User>tim</User>
      <Date>2022-12-15T11:46:46+01:00</Date>
    </MergeItem>
  </Changed>
  <Moved>
    <MovedMergeItem>
      <ItemType>File</ItemType>
      <SrcPath>/LICENSE.txt</SrcPath>
      <DstPath>/LICENSE</DstPath>
      <Size>39</Size>
      <User>tim</User>
      <Date>2022-12-15T11:46:46+01:00</Date>
    </MovedMergeItem>
  <PermissionsChanged>
    <MergeItem>
      <ItemType>File</ItemType>
      <Path>/Assets/guy.brush</Path>
      <Size>20</Size>
      <User>tim</User>
      <Date>2022-12-15T10:46:46+01:00</Date>
    </MergeItem>
  </PermissionsChanged>
  </Moved>
  <Warnings />
  <DirConflicts>
    <ConflictedItem>
      <ConflictItemType>DIV_MV</ConflictItemType>
      <SourceDiff>
        <ChangeType>Moved</ChangeType>
        <ItemType>File</ItemType>
        <SrcPath>/PLAN</SrcPath>
        <DstPath>/JC_PLAN</DstPath>
      </Source>
      <DestinationDiff>
        <ChangeType>Moved</ChangeType>
        <ItemType>File</ItemType>
        <SrcPath>/PLAN</SrcPath>
        <DstPath>/RJ_PLAN</DstPath>
      </Destination>
    </ConflictedItem>
  </Conflicts>
</Merge>
```

See --usage for details:

```console
> cm merge --usage
```

#### All Platforms - Plastic

All Platforms - Plastic: Merge files from command line with Binary Merge

A quick way to get started is to run Plastic with a single argument:

* For Windows:

plastic binmerge

* For MacOS:

plasticgui binmerge

* For Linux:

plasticgui binmerge

For example, To merge two files with a common base file:

```text
[plasticgui|plastic] binmerge -s=fileA.txt -d=fileB.txt -b=base.txt
```

In order to determine if a merge was successful, Plastic will return 0 or 1 as the application exit code. 0 means a merge was successfully performed and the result file has been save, 1 means that a merge has been aborted or not saved.

### Bug

#### All platforms - Plastic

All platforms - Plastic: Corrected Merge View title when applying shelveset

When applying a shelveset the view title is now "Apply shelveset sh:\<shelveset id>".

#### Windows - Gluon

Windows - Gluon: Legacy merge tool opening for shelveset conflicts

On Windows Gluon, when trying to apply a shelveset that is in conflict with the local changes, we were opening the legacy merge tool (native to Windows). We fixed this issue, and now the new cross-platform merge tool is used instead

***

## 11.0.16.7709

> **Note:**
>
> **Public** | 2023-01-12

### New

#### Windows - PlasticFS

Windows - PlasticFS: Upgrade to WinFSP 2023 Beta1

Among other changes, the next version of WinFSP does not require to reboot for upgrading.

You can find the WinFSP release notes in [https://github.com/winfsp/winfsp/releases](https://github.com/winfsp/winfsp/releases).

#### Windows - PlasticFS

Windows - PlasticFS: Junction support for dynamic workspaces

We added support for junctions to PlasticFS! Tools that create temporary junctions on disk can now run on dynamic workspaces.

Before:

```console
> mklink /J assets ..\..\game_tree\assets

Local NTFS volumes are required to complete the operation
```

After:

```console
> mklink /J assets ..\..\game_tree\assets
>
```

In PlasticFS, junctions have the same limitations and capabilities that symlinks have, with the following exceptions:

* Junctions, they can only be used with directories. The flip side is that, unlike symlinks, junctions always have the right type.

* Junctions only support absolute paths.

* Plastic itself does not distinguish between "junctions" and "symlinks". Adding a junction to source control will eventually replace it with a symlink.

\== REQUIREMENTS ==

Besides PlasticFS, you might want to enable symlinks in the GUI and the command-line interface.

To do so, add the following to your client.conf:

```text
<EnableSymlinkSupportOnWindows>yes</EnableSymlinkSupportOnWindows>
```

\== LIMITATIONS ==

1. This feature is in an early stage of development, so you can expect minor bugs to happen.

2. Currently, junctions are not allowed to point to the dynamic workspace directory nor anything outside it.

#### All clients

All clients: Incoming Changes only checks-out local changes involved in conflicts.

Before, the Incoming Changes & merge operations applied all the local changes in the workspace before running the operation. It didn't matter whether these local changes were in conflict with the changes to update/merge or not.

This could end up locking exclusively some files that were only locally modified (unrelated to the merge/update) and preventing other users to modify those files due to an undesired lock.

Now, only the local changes that are in conflict with the server changes to update/merge are applied in the workspace.

This new behavior applies to PlasticX, Plastic and the command line client (it's not available or partial/Gluon workspaces yet).

#### All platforms - PlasticX, Command-Line Client

All platforms - PlasticX, Command-Line Client: Triggers are not accepting URIs on Windows servers

Due to the possibility of working cross-platform, sometimes Plastic is performing paths correction to fit the different OS's syntax. Therefore, anything that might be considered as a path can be altered by replacing slashes with backslashes on Windows. That was affecting the trigger commands, which can receive arguments. Usually, these arguments are expected to be paths, many times the executable itself, but it is also possible to use Internet addresses and endpoints. These addresses were being altered when parsing the command arguments (replacing the slash). That was leading to unexecutable triggers on Windows servers.

Now it is fixed and it will be possible to create triggers receiving valid URIs as arguments.

For instance:

```console
cm tr mk before-update TryToLoginTrigger "curl -X POST http://localhost:8080/login ./secret.key" --server=localhost:8084
```

When creating the command on a Windows machine, it will fix the "./secret.key" path to convert it to ".\secret.key" but the localhost endpoint will remain the same.

This allows new possibilities of interaction through triggers on Windows machines.

NOTE: to be able to distinguish between local paths and external URI, it is advisable to use absolute URIs.

A known limitation for this would be the following syntax:

```console
cm tr mk before-update UnityTrigger "curl -X POST unity.com/amazing" --server=localhost:8084
```

Under the hood, Plastic will modify the "unity.com/amazing" and use the "unity.com\amazing" endpoint instead, because the literal complies with the local path formation rules.

The way to avoid the issue would be to use the absolute URI referring to the same endpoint: `https://unity.com/amazing`, which will remain unaltered.

#### Command-line client

Command-line client: status command now gives changed/unchanged info for checkouts

Unlike in the GUIs, the command line was only able to show an item as either checked-out or changed, but not both at once. This made hard to tell if a file was actually modified or not:

```console
> cm status --noheader
Changed
    Status         Size        Last Modified     Path

    Checked-out    10 bytes    12 minutes ago    checked-out-CHANGED.txt
    Checked-out    11 bytes    13 minutes ago    checked-out-unchanged.txt

> cm status --noheader --compact
Modified items (CH = changed, CO = checked-out, CP = copied (new), RP = replaced)
 CO checked-out-CHANGED.txt
 CO checked-out-unchanged.txt
```

Now, additional detail is given when changes are found:

```console
> cm status --noheader
Changed
    Status                     Size        Last Modified     Path

    Checked-out (changed)      12 bytes     1 minute ago     checked-out-CHANGED.txt
    Checked-out (unchanged)    11 bytes    21 seconds ago    checked-out-unchanged.txt
```

The "--compact", "--xml" and "--machinereadable" options don't display these details by default. It is so to not break existing integrations/automations. You need to combine them with the "--iscochanged" option to see the additional information.

```console
> cm status --noheaders  --noheader --compact
Modified items (CH = changed, CO = checked-out, CP = copied (new), RP = replaced)
 CO checked-out-CHANGED.txt
 CO checked-out-unchanged.txt

> cm status --noheaders --noheader --compact --iscochanged
 CO+CH checked-out-CHANGED.txt
 CO checked-out-unchanged.txt
```

Note that this information is only provided when the status command is searching for changed items (see the --changed option in --help for details). For instance, in case you only need to find whether items are or not checked-out, you can filter the search by using the --checkout option. That way, those details will be omitted as before.

### Bug

#### Server

Server: Incoming Changes failed with path permissions and a cloaked rules.

From 11.0.16.7656, the Incoming Changes failed and didn't appear when certain conditions were met: 1) there were set path permissions, 2) no cloaked.conf in the client and 3) a cloaked.conf loaded on the head tree of the branch (it contains a /cloaked.conf file). Now, it's fixed.

#### All platforms - GluonX

All platforms - GluonX: Null exception on clicking the Get Plastic link button in Checkin view

We fixed it to don't show this button in the details panel for the Checkin View because it is only available for the Explore workspace view.

***

## 11.0.16.7696

> **Note:**
>
> **Public** | 2022-12-22

### New

#### All platforms - Command-line client

All platforms - Command-line client: the diff command allows now to see the branch changes pending to integrate

You can use the new diff option --integration (e.g.: 'cm diff br:/main/task --integration') to see the branch changes pending to be integrated into its parent branch.

See some scenarios when it's useful:

* You are working on a child branch, and you make a rebase, a merge from /main. The regular 'cm diff br:/main/task' command will show the child branch changes combined with the rebased changes. Now, with the 'cm diff br:/main/task --integration', the command will skip the rebased changes. You will see a cleaner, more focused view of the actual branch changes.

* You are working on br:/main/task and you merge it into br:/main. Then you realize that you need additional changes in the branch and make them. The 'cm diff br:/main/task --integration' command will show those additional changes that you didn't merge yet.

#### All platforms - All clients

All platforms - All clients: Pending changes: "Copied" items are now listed in "added" category

A "copied" is an existing item that is copied from a source changeset into the current one where it doesn't exist. It could happen due to a merge or revert operation.

Previously the copied changes were inside the modified category:

```console
$cm status --noheader
Pending merge links
    Cherry pick from cs:3 at /main/added_file@change_delete_tests@localhost:7777

Changed
    Status                              Size       Last Modified    Path

    Copied (new) (Cherrypick from 3)    7.95 KB    7 minutes ago    FindMerge.cs
```

Now they are inside the added category, as the item is a new one on the current changeset even if it already exists on the repository:

```console
$cm status --noheader
Pending merge links
    Cherry pick from cs:3 at /main/added_file@change_delete_tests@localhost:7777

Added
    Status                              Size       Last Modified    Path

    Copied (new) (Cherrypick from 3)    7.95 KB    4 minutes ago    FindMerge.cs
```

#### All platforms - All clients

All platforms - All clients: New "change - not loaded"  conflicts for cherry-picking merge & apply shelve

The old "change - delete" conflicts were replaced by the new "change - not loaded" conflicts for the cherry-picking merge, and apply shelve, where the changed item is not deleted on the destination, it's simply not loaded.

These new conflicts give a more accurate description and actions for these types of conflicts:

* Changed file on the source that doesn't exist on the destination:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/1de4b23de011cdd849adae70b24d54eba8f16cabd795391e8d535ce2baf51ba3.png)

* Changed file on the source whose parent doesn't exist on the destination:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/ef779b54022e736ec89d2894670c8066be1edb3a7ba62c2425168875c7b753e8.png)

* Added file on the source whose parent doesn't exist on the destination:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/3bcca3ff4a7d2fed77ad65713e48cf8de30114541bcb54f7efaf7332299b30f2.png)

#### All platforms - PlasticX, Command-Line Client

All platforms - PlasticX, Command-Line Client: Basic Auth now working with webtriggers

Webtriggers requiring basic authentication were not supported. There was a workaround to create a script with the call (using curl for instance inside a \*.bat or \*.sh file) including the authentication and then wrapping that script call within a regular trigger. Now it is possible to directly use webtriggers with basic authentication instead.

For example, imagine you have a configured Jenkins with a job named "MyProject" and you would like to call Jenkins to build the project after a check-in has been successfully completed. You could create a trigger like the following:

```console
cm trigger mk after-checkin buildJenkins "webtrigger http://user:pass@localhost:8080/job/MyProject/build" --server=localhost:8084
```

#### All platforms - Plastic, Gluon

All platforms - Plastic, Gluon: Added new arguments

The following arguments were available in legacy Windows GUI. Now we added them  to the new cross-platform GUI:

* `--clientconf`: Lets you use a custom client.conf file, instead of the one at the default location

* `--branchexplorer`: Opens the branch explorer view of the specified workspace

* `--preferences`: Opens the preferences view when Plastic starts

* `--createworkspace`: Opens the dialog to create a new workspace when Plastic starts

In addition, arguments used to open the legacy GUI are now passed to the new GUI when clicking the "Try new GUI" button

#### All platforms - Plastic, Gluon

All platforms - Plastic, Gluon: Provided better description in User Profile Tab

We renamed Preferences "User Profile" tab to "DevOps User Profile" to avoid confusion with "Connection Profiles"

Also, a explanation text and additional help hyperlinks were added, improving the documentation of this tab and giving better descriptions to the users


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/9c5c6b932d5501c44905d60f8e462cf6cbc83f132f7401c1f09ed6c7fbffae19.jpg)

#### macOS, Linux - Plastic

macOS, Linux - Plastic: Cross-platform semantic merge tool enabled by default

From now on, in macOS and Linux, when there is a non-automatic merge conflict on a code file, the cross-platform semantic merge tool will be launched to solve the conflict. Until now, you had to manually enable it by adding a flag in the client.conf file.

On Windows the native tool is still the default one, so you need to add the flag in client.conf if you want to use the new cross-platform tool:

```text
<EnableSemanticMergeCrossPlatform>true</EnableSemanticMergeCrossPlatform>
```

#### All platforms - Plastic

All platforms - Plastic: shelvesets can now be filtered

We've improved the shelving workflow in Plastic by adding flexibility when applying a shelveset to your workspace. Now you can pick and choose individual files from a shelveset and apply only those that you want.

Shelvesets are chosen from the Shelves view, accessed using the "Show Shelves" button on the Pending Changes view, in the usual way:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/661d2a40712047bdb10c7a700d0154c4aa7add7d23b027de0857c875d61cbfa1.png)

Check the files in the shelveset that you want to apply to your workspace. Unchecked files will be ignored:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/6527e1c78d6f0764395aa428db88f4d0f5d66cd53045d03b4fb0bb5a9a019521.png)

### Bug

#### All platforms - Plastic, Gluon

All platforms - Plastic, Gluon: Page Up/Down keys navigation fixed

We've fixed in this release Page Up/Down keys navigation for all Tables and Trees


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/c94f88a07dda1a6131c2faf18b72d17a4ac916969e903f79eeaaa7e0c80a97d4.gif)

#### All platforms - Plastic

All platforms - Plastic: Fixed exception when using the semantic icons bar

When clicking on "Diff changed code..." from the semantic icons bar in a changed portion of a file, an exception was thrown. We fixed this issue and now the diff window is opened correctly


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/6410052798e7fc7366c0611a81802a326a9db3d0ab254ab0a92afd93e45b52e1.png)

#### All platforms - Command-line client

All platforms - Command-line client: Failing to create an Xlink leaves a private directory

So far, trying to create an Xlink to a non-existent item still created a a private directory in the workspace.

Now, the item is solved before the xlink command can tinker with the workspace.

#### All platforms - IntelliJ

All platforms - IntelliJ: IntelliJ plugin diff does not display properly

Previously to this change, diff was not displayed properly if the revision was pointing to a shelve as the internal find command was lacking shelve option. We added shelve option and parse revId correctly so the content can be downloaded and displayed.

***

## 11.0.16.7679

> **Note:**
>
> **Public** | 2022-12-15

### New

#### DevOps

DevOps: TrunkBot now deletes shelvesets for Xlinks

When merging a task, the TrunkBot creates a shelveset that gets deleted when done. If the repository contains Xlinks, shelves are potentially created for each "xlinked" repository.

Before, the TrunkBot only removed the shelveset of the root repository, so the shelves of the "xlinked" repositories were left behind.

Now server and TrunkBot were improved so all shelvesets are properly cleaned.

#### Command-line client

Command-line client: Automatic shelve before switch (with pending changes).

The 'cm switch' and 'cm partial switch' commands now ask about shelving the workspace changes before continuing with the switch operation when there are pending changes in the workspace.

If the answer to the question is yes, it automatically shelves and undo your local changes before continuing with the switch operation.

This new behavior only happens if the following option is set in the client.conf configuration file.

```xml
<PendingChangesOnSwitchAction>Shelve</PendingChangesOnSwitchAction>
```

The shelve question can be skipped if the switch commands are executed with the '--noinput' option. In this case, the shelve + undo are run by default before the switch operation.

#### MacOS - Plastic

MacOS - Plastic: Automated update workflow

The update workflow has been improved on MacOS! It automatically downloads the latest release and executes it, whenever an update is available, and the user wishes to update.

#### All Platforms - Plastic/PlasticX/GluonX

All Platforms - Plastic/PlasticX/GluonX: Semantic supports C# 9, and 10 versions!

We modified Semantic Diff/Merge to support the new features introduced in the C# (9, and 10), and VB (16.9) languages for all platforms.

Here is a sample for C# 9 files with target-typed new expressions, and top-level statements (program without Main method):


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/a299810c99f20a67eea32818a4ea313709747d89075d2d910c6dec4951cca300.png)

Here is a sample for C# 10 files with global using, file-scoped namespace, and constant interpolated strings:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/b461dcb748d90c7720b3226e831e97120f86f17a4990d51219fd42830848bd2d.png)

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Removed the repositories view from the switcher window

When you clicked on the workspaces drop down at the top and selected "View repositories..." you would see the switcher window with a list of all the repositories you can access. This information was redundant, because you can also see the repositories from the home view. We removed the repositories view from the switcher window, and now it only displays the list of your workspaces

#### All Platforms - Plastic

All Platforms - Plastic: Check for update option

You can now to check for a new update at any time, by selecting it from the application context menu.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/2262c43e30be72edb1f82fa058fac4adb239ef1644150cd7c59f23774d7cc252.gif)

### Bug

#### All platforms - Plastic, Gluon

All platforms - Plastic, Gluon: Home shows error message selecting repo with read permission denied

Plastic app could show a "An unexpected error has occurred" message in Home View if a repository with no read permission was selected, we fixed this issue

#### All platforms - Plastic, Gluon

All platforms - Plastic, Gluon: Home will show public directories in repos with root path permission denied

We fixed the following scenario:

If an admin account denied all root permissions to another user accounts, but some subdirectories are public, HomeView would show empty repository to these users

This is the full repo an admin user could have:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/aca9b2fc106635fd7f20dde370da3a3b1d98db74bd8841875de22886ce2e985e.jpg)

And this will be the Home View normal users will now see in this scenario:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/8d82c86973c613be643f4c01b90982c973bf5e21b417e47135e4f5ba4f21853b.jpg)

#### Windows - Visual Studio 2022 plugin

Windows - Visual Studio 2022 plugin: Prevent private files from showing CodeLens information

Previously to this change, private files were showing "Private" for every method and class and an empty tooltip. Now we are hiding useless information.

#### Command-line client

Command-line client: status --short option not providing a list of files

Before, the status command didn't provide a list of files as the help said. It couldn't be used in a pipeline without some workarounds.

Now it is possible to use it as expected:

```console
> cm status --short | cm unco - --keepchanges
```

#### All platforms - Plastic, Gluon

All platforms - Plastic, Gluon: Home View Path permissions created with \ instead of /

In the Home View, if we browse a file o directory to add a Path Permission, backslashes were used instead of forward slashes, we fixed this issue


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/30a7213bdb4ee5c118dac7d782bc808df45e5d1c081f0f31c42b674b11835e31.jpg)

***

## 11.0.16.7665

> **Note:**
>
> **Public** | 2022-12-01

### New

#### Command-line client

Command-line client: Update command improved for automation

Several adjustments have been made to the update command:

Before:

* Using the --xml option was not meant to be used in a pipeline.

* Using the --silent option was meant to trim all output.

Now:

* Using the --xml option with no file implies --silent. Informative output gets trimmed.

* Using the --silent option removes informative output only. Warning and error messages are still written through standard error output. You can silence those messages by using output redirection.

#### All clients

All clients: Incoming Changes respects the cloaked rules.

Before, the Incoming Changes operation downloaded the files/directories although they were under cloaked paths. This was inconsistent with the update operation behavior and with the cloaked semantics themselves.

Now, the changes under cloaked paths are skipped like the update operation does.

The Gluon Incoming changes is not affected by this behavior (cloaked rules don't make sense in Gluon) since the operation works in a different way.

#### All Platforms - DevOps

All Platforms - DevOps: Jenkins plug now shows the link to the build job

The Jenkins plug now notifies the URL to the build job. This way users are able to get the details about what failed while building the task in Jenkins.

Find below a sample of this notification using a local Jenkins plug with a TrunkBot mergebot on Slack:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/5761afea11ea51b57635d81a5bf55748cd50baecf827cbb50ab37c385144a1f6.png)

#### Command-line client

Command-line client: Switch command improved for automation

Several options have been added to the switch command, mirroring the update command: --silent, --verbose, --xml and --encoding.

See --usage for details:

```console
> cm switch --usage
```

#### Command-line client

Command-line client: Undo controlled changes and preserve local content

Added the option -k | --keepchanges to the cm unco & cm partial unco to allow undo checkout and preserve all local changes.

It could be very useful when you have a checked-out file with some changes for testing that you don't want to check in. So, now, you can undo the checkout (that releases the lock), and preserve local changes just to continue with your local tests.

```console
$cm status --noheader
Changed
    Status         Size         Last Modified    Path

    Checked-out    319.30 KB    1 minute ago     body.png

$cm unco -k
c:\tmp\quake\body.png unchecked out correctly

$cm status --noheader
Changed
    Status     Size         Last Modified    Path

    Changed    319.30 KB    1 minute ago     body.png
```

The unco -k command can be applied to all kinds of controlled changes, turning them into local changes. This is complementary to using the checkout command to promote local changes into controlled ones.

* Added are left as private

* Checked-out are left as changed

* Deleted are left as locally-deleted

* Moved are left as locally-moved

Note this option is incompatible with dynamic workspaces.

#### All platforms - Plastic, Gluon

All platforms - Plastic, Gluon: Improved app stability

We've improved app stability in some scenarios, preventing the app from crash when an exception is thrown

#### Command-line client

Command-line client: Update --xml now includes deleted items

Before, the --xml output of the update command was meant to only report items with added or updated revisions.

Deleted items are now included:

```console
<UpdatedItems>
  <List>
    <UpdatedItem>
      <Path>/wkspaces/SuperRacing/Assets/wheels.png</Path>
      <User>Kit</User>
      <Changeset>122</Changeset>
      <Date>2022-11-27T20:30:44+01:00</Date>
    </UpdatedItem>
  </List>
</UpdatedItems>
```

#### All platforms - Plastic

All platforms - Plastic: Disabled Semantic History option for unsupported text files

We've disabled Semantic History menu option in Annotate View for all unsupported text files in semantic history (for example, .txt files)


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/1222da6200edd0c71b40fd0994ab4efcb4042829803597eb09563e055b8e15ff.jpeg)

#### macOS - Plastic

macOS - Plastic: Removed mono-based GUI's

We finally removed the mono-based GUI's that were deprecated months ago, in favor of net(core) based counterparts: `plasticgui` and `gluon`.

This way we ease the setup of the Plastic SCM GUI applications, since no more "mono/xamarin" and related dependencies will be a requirement anymore.

### Bug

#### All platforms - Plastic

All platforms - Plastic: Fixed exception in diff when selecting files outside of refactor group

We fixed an error that was causing an exception to be thrown when selecting an item in the diff window that is not inside a refactor group.

#### Command-line client

Command-line client: Unrelated conflicts when applying a shelve.

The 'shelveset apply' command could show some directory conflicts that were not related to the changes/paths specified in the command.

This happened when 1) only some changes were specified to be applied from the shelveset and 2) there were more than one directory conflicts involved in the shelveset application.

The problem came because the filter used to apply only the specified changes was not applied again after resolving a directory conflict. Fixed.

#### Command-line client

Command-line client: Update command --xml and --silent options are incompatible

Before, using the --silent option allowed the XML output to be printed but affected to the contents themselves.

Now, those options are compatible. Moreover, the --xml option now implies --silent.

***

## 11.0.16.7649

> **Note:**
>
> **Public** | 2022-11-24

### New

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Updated Avalonia version

In this release we've updated Avalonia, our cross-platform UI framework, to the latest public release

This update brings many stability improvements under the hood, and also addresses the following macOS issues:

* Sometimes a dialog could hang the app, this issue is fixed

* Merge links are now clickable again in Branch Explorer

* Fixed strange issue where buttons could disappear

* Fixed flickering in the Home View

#### All Platforms - PlasticX

All Platforms - PlasticX: Jira task details on branch explorer

You can now see and navigate to a Jira task when using the Jira extension to create a branch.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/055900dbeb134d7363e841c4b3d524a6d0572ac2ba4aaf4caf1e7207d47981eb.png)

#### All platforms - PlasticX

All platforms - PlasticX: Launch Semantic Merge as standalone

The Semantic Merge tool could be launched from the command line using:

```console
plasticx semanticmerge -s=source -d=destination -b=base
```

For unsupported file formats the merge tool will be launched instead of semantic merge. If the base argument is missing in the command line, the diff tool will be launched instead.

#### All platforms - PlasticX

All platforms - PlasticX: Clarification message for deleted repositories

Improved description of how long repositories are kept in storage after being deleted.

### Bug

#### All platforms - PlasticX

All platforms - PlasticX: Branch options not working in Merge diagram

When the merge diagram was opened from the Merge view, some of the available actions from the branch context menu were not working as expected.

#### Command-line client

Command-line client: Misleading diff result message

When requesting a diff of a private file or non-existent file, the message tries to indicate that there is nothing to compare it with.

However, this feature includes a misleading message:

```console
> cm diff private_file.txt
Item has only one revision.
```

Now this is corrected:

```console
> cm diff private_file.txt
There is no previous revision for this item.
```

#### All Platforms - Command-Line Client, PlasticX

All Platforms - Command-Line Client, PlasticX: Codereview creation with triggers fails.

Having an "editreview" trigger enabled, the creation of a code review through PlasticX fails.

This happens becase, when creating a code review with the CLI or with the PlasticX application, the reviewer might not be specified in the command and it is not set by default in PlasticX when the creator of the code review is the same user who created the branch.

Now it is fixed.

#### All platforms - PlasticX

All platforms - PlasticX: Corrected semantic outline for multi-file moves

We corrected the information displayed in the semantic outline when we detect that code has been moved from one file to another.

Here is an example:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/90a0cb022dcfe5adaceafdb0151ddf1b10a22c49c62d2f6ee8303b712e39d57c.png)

#### All platforms - PlasticX

All platforms - PlasticX: Check-in button disabled during the check-in operation

We've disabled the Pending Changes view Check-in button until the check-in operation is complete

#### Windows 10

Windows 10: We disabled the possibility of negotiating TLS 1.3 connections on Windows 10

This TLS version is experimental on Windows 10 and, although it can be enabled and forced through registry hacks, it is not officially supported (as per Microsoft documentation) and won't work when trying to connect to Plastic SCM Cloud nodes.

By doing this, we re-enabled TLS 1.3 support on Windows 11, Windows Server 2022, and all other platforms that support it.

#### All platforms - GluonX

All platforms - GluonX: Error sorting columns in the Workspace Explorer view

If a user tries to sort by the Changeset column in the Workspace Explorer view and one item has no revisions (for example, a newly created file), the operation throws an exception.

We've fixed this issue.

#### All platforms - GluonX

All platforms - GluonX: Shelve and undo changes, fixed null exception error message

We've fixed the following scenario in GluonX:

If a user undo changes right after a shelve operation, and the Pending Changes view was completely cleared, a null exception could appear

***

## 11.0.16.7626

> **Note:**
>
> **Public** | 2022-11-17

### New

#### All platforms - DevOps

All platforms - DevOps: TrunkBot adds tasks' title to the check-in comment when merging

Now TrunkBot mergebot will add the task' title from the configured issue tracker to the check-in comment when a merge is successfully performed. If there is no configured issue tracker, it will add the branch comments instead.

#### All platforms - Server

All platforms - Server: Deleting an object now deletes the associated code review data.

Now, when deleting a changeset, a shelve, or a branch, all the associated code review data gets deleted as well. This means that all code reviews targetting a changeset or a shelve, as well as all the code review comments made on a changeset or a shelve, will be deleted along with the changeset or shelve. When deleting a branch, all the code reviews targetting the branch will be deleted too.

Until now, the only thing that happened (regarding code reviews) when deleting a changeset was that all the change requests applied on said changeset were marked as not addressed. Now, the cleanup is complete.

#### All platforms - Command line client

All platforms - Command line client: Now you can create code reviews for shelves!

If you want your colleagues' feedback on some code, but don't want to actually check in the changes, now you can create a shelve and ask them to review the changes with the integrated code review functionality! Bear in mind that creating the code review only works (from now) from the `cm` command line client, but once created, you can open the code review from the GUIs.

To do so, you will need the shelve ID of your shelve. You can obtain that from the "ID" column in the "Show shelves" view in the GUIs, or by running a `cm find` command:

```text
cm find "shelves where owner = 'me' on repository 'secretproject@coolorg@cloud"
```

Then, create the code review specifying the shelve:

```text
cm codereview sh:1354@secretproject@coolorg@cloud "Please review this change with care!"
```

The code review can then be opened and edited from the GUIs.

#### Server

Server: Deny temporary access for some specific users

Now you can deny access to certain users. To do so, create a deniedusers.conf file inside the server directory and add a user per line.

You don't need to restart the server, but note it might take some seconds until the server reloads the list of users with access denied.

Examples:

```console
alice
bob
```

Note users might look different, as it depends on the configured authentication:

```console
alice@mail.com
bob@mail.com
```

#### Windows - PlasticX

Windows - PlasticX: PlasticX is now the official GUI on Windows

We are happy to announce that our new, cross-platform, GUI is now the official GUI on Windows.

To launch the new GUI simply run plastic.exe as before. The old windows gui has been renamed to LegacyPlastic.exe.

#### Windows - PlasticFS

Windows - PlasticFS: Symlink support for dynamic workspaces

We added support for symlinks to PlasticFS!

Now symlinks are supported everywhere in the Plastic ecosystem: Windows, Linux, macOS and PlasticFS.

\== REQUIREMENTS ==

1. While PlasticFS does not need anything to support it, you might want to enable the Windows client support. This will allow the command line and PlasticX/GluonX to work with symlinks on Windows.

To do that, add the following configuration setting to your client.conf:

```text
<EnableSymlinkSupportOnWindows>yes</EnableSymlinkSupportOnWindows>
```

2. If you update an existing dynamic workspace, you will find placeholder files where symlinks should be. To get the actual symlinks, you can delete the placeholder files, then tell Plastic to undo changes so they are recreated.

Be sure to read the LIMITATIONS section before using.

\== HOW TO USE THEM ==

You can use mklink as usual to create some symlinks:

```text
mklink filelink file.txt
mklink /D dirlink dir
```

Note that, unlike with static workspaces, you don't need to enable Developer Mode to make it work!

\== LIMITATIONS ==

1. This feature is in an early stage of development, so you can expect minor bugs to happen.

2. PlasticFS always creates symlinks as files. By trying to access them, they will be automatically solved and converted to directories. However, this step might confuse external programs that do not expect it.

* This happens anytime you create a new workspace or after undoing a placeholder file (see REQUIREMENTS section).

* Windows Explorer will force this conversion, but you will have to refresh the window the first time it shows a symlink.

3. Currently, relative symlinks are not allowed to link the mount point directory or anything above it.

#### All platforms - PlasticX

All platforms - PlasticX: View deleted repositories on home view

You can now see the recently deleted repositories on the home view!

It is accessible by clicking on the cog icon near the search bar.

To restore a deleted repository, simply right click on the deleted repository and select the "undelete" option


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/ecaba4e8a0bd50859a277afcc16bbcc932ce8e40b193b22194da49c42886cb69.gif)

### Bug

#### Windows - Visual Studio 2022 plugin

Windows - Visual Studio 2022 plugin: Fixed issue when opening Pending Changes

After uploading Visual Studio 2022 to version 17.2.0 or higher, if the solution contained a solution's folder, Visual Studio plugin was prompting the error:

"GetSccFiles must be called on the UI thread"

It was preventing the Pending Changes view from working properly.

The issue has been fixed and now Pending Changes is fully usable in any situation.

#### All platforms - PlasticX

All platforms - PlasticX: Flicker issue in the pending changes refresh

The refresh operation for the pending changes view launched different operations to calculate the review comments to apply and the pending changes which caused a flicker issue. We unified those operations to avoid this issue.

#### All platforms - PlasticX

All platforms - PlasticX: Missing success message after creating a shelveset

After creating a shelveset the success message was shown in the status bar but it was immediately hidden due to an issue in the pending changes refresh operation that overwrote the message with the progress. Now it's fixed.

#### All platforms - PlasticX

All platforms - PlasticX: Fixed slow pending changes category checkbox

We improved the performance of toggling a pending changes category checkbox when the category contains a very large number of items.

For example, toggling a category containing 30,000 items used to take about 20 seconds, and now takes less than half a second.

#### Cloud Server

Cloud Server: Fixed deadlock with concurrent checkins in the same repo.

The cloud server uses locks to handle concurrent access to the Jet files and to the internal caches. There was a race condition where concurrent checkins (in the same repo) that added new files to the repo could get stuck forever due to a deadlock between the previous mentioned locks. Fixed.

This was a corner scenario since the race condition was not easy to reproduce without the right debugging.

#### All platforms - GluonX

All platforms - GluonX: Details Panel could not be resized.

We found a rare scenario in the Details Panel where this subview couldn't be resized anymore.  We fixed this issue

Also, we have also set minimum width to the Workspace Explorer and Checkin Views when Details Panel is shown to the users

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Skip format changes not working properly

There's an option in the pending changes view and diff view that allows you to skip format changes when diffing two versions of a file, such as line endings or spaces. This option was not being initialized correctly, and even when it was enabled, it appeared as disabled in the GUI. This issue is now fixed

#### All platforms - PlasticX

All platforms - PlasticX: Diff/Merge Window crash after Cut empty text

PlasticX crashed cutting an empty line from the editable text editor in diff/merge view.

***

## 11.0.16.7608

> **Note:**
>
> **Public** | 2022-11-07

### New

#### All platforms - Plastic

All platforms - Plastic: Semantic Visual Differences are here!

We ported the Visual Diff feature from the Windows Legacy GUI to the new (multiplatform) GUI, which means that now, the Visual Diff feature is available on three platforms, Windows, macOS, and Linux!

The Visual Diff is a diagram that helps to understand the changes made to a file, in a semantic way. Visual Differences are available for those file formats that support semantic differences (.NET, Java, PHP, C, C++). When the semantic differences are calculated, the Visual Diff displays a graphical representation of them. The diagram displays, classes, usings, methods, members, fields, etc, and some decorations indicating if an entity was added, changed, moved, or deleted. It also helps to display the differences between them.

The Visual Diff is available in three places:

1- The Diff Control (note that we also implemented a couple of options for the semantic diff):

* Skip format changes: This option ignores the indentation and EOL changes when the semantic diffs are calculated.

* Reformat: This option automatically reformats the source code:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/ea09df756139ad3d62fa134bd7d3852579a00bfd7b12fcd51ce6fe2a3872c30a.gif)

2- The Diff Window, when clicking a Refactor Group when using our "analyze refactors" feature:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/7c06d6cb693ac02cf65c575b3d61473457484525b53641139c43efe6a6dc1a9c.gif)

3- The Semantic Merge tool:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/36acd73862945a64227a32367e37077cefb4b53f300f9038490b4016090f2a8c.gif)

#### All platforms - PlasticX

All platforms - PlasticX: Visual diff window new design

Some colors and layout design has been changed for the Visual diff window in order to improve legibility and visibility for both themes.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/9d32b1238dc398ba04b58450c876a4fafddc2f1f887130af7b1af724c27f59b8.png)


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/9a03bb312f61585f91f9ea7516e8f21bd3abab99f2330eef1d7409a588f2272b.png)

#### Linux - Plastic

Linux - Plastic: removed mono-based GUI's

We finally removed the mono-based GUI's that were deprecated months ago, in favor of netcore-based counterparts: `plasticgui` and `gluon`.

This way we ease the setup of the Plastic SCM GUI applications, since no more "mono" and related packages will be a requirement anymore.

The final goal is to support newer distros, and for that goal, this removal of mono-based applications is a must.

> **Note:**
>
> The package name was renamed from `plasticscm-client-gtk` to `plasticscm-client-gui`, but your package manager should care automatically of this renaming.

#### Linux - Client and Server

Linux - Client and Server: Added support for Ubuntu 22

Now you can install Plastic SCM on Ubuntu 22 using the package manager! Instructions [here](https://www.plasticscm.com/plastic-for-linux), "Ubuntu" tab.

Easy to say, long road until we made it! This Ubuntu 22 support pulls some relevant changes in the Plastic SCM software stack:

1. Mono removal: We don't require installing `mono` runtime anymore. We now rely on .NET specific OS-targeted self-contained executables for all Plastic SCM applications, even client-GUI applications (server was already compiled this way since early 2021).

2. Legacy GUI's removal (gtkplastic, gtkgluon, gtkmergetool). Since they were based in mono, they need to be removed and replaced by .NET counterparts: `plasticgui` and `gluonx` (mergetool is now part of `plasticgui` application and can be launched using `plasticgui xmerge`).

3. Move server from .NET 5 to .NET 6

All these changes were required in order to meet dependencies needs for Ubuntu 22, specially on ssl libraries and graphical toolkit libraries.

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Damaged image file won't show error pop up in Pending/Checkin Changes Views.

Selecting a damaged image file won't show error pop up message in Pending Changes/Checkin Changes Views.

The error message will still be visible to the user as a label notification, and also in the Details Panel (GluonX only)

#### All platforms - GluonX

All platforms - GluonX: Visual feedback when cutting items

When cutting items from the workspace explorer view, now there is a transparency effect in the icon of the elements that have been cut.

This feature was already available on Plastic, and now it's on Gluon too.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/9e946be328ca1e604d164fac1cdcffc072eac64b20b47ff0ff2729bb06745551.png)

#### All platforms - Plastic

All platforms - Plastic: Allow changing the editor font.

Now, the diff/merge font can be changed.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/5de126d93a33b56108cc70a134deddafcba47a6a4b4553dc83fda3d8fdfbf4b9.gif)

NOTE for windows users. The default monospaced font in Windows OS (if available) is [Cascadia Code](https://github.com/microsoft/cascadia-code), which enables [font ligatures](https://learn.microsoft.com/en-us/visualstudio/ide/how-to-change-fonts-and-colors-in-visual-studio?view=vs-2022#use-the-cascadia-code-font), so if you want to disable them, you can change the font to use Cascadia Mono, or other available font in your system.

#### All platforms - Plastic

All platforms - Plastic: Full Unicode support and IME.

Previous versions of Plastic didn't fully support double-byte languages (Chinese, Korean, Japanese, etc ...). This Plastic version supports, not only double-byte languages and emojis, but also supports IME (Input Method Editor) for these languages, and right-to-left input support for Arabic and other languages.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/cc55d7598db56273f80e910ee0658dd0e54763913919e5e175c1b0c0dd1ef25c.gif)

NOTE for Open Suse Linux users: After this changes, Open Suse 15.2 is no longer supported. An upgrade to Open Suse 15.3 is required in order to run Plastic.

#### Server - Merge and Incoming Changes are much fast…

Server - Merge and Incoming Changes are much faster tons of ChangeDelete conflicts.

The calculation of the merge or the incoming changes was very slow when there were tons of ChangeDelete conflicts involved in the operation.

In the studied case, 2 million of items were added in the source of the merge but all of them were added under a deleted directory in destination. It initially took more than 2 hours to calculate the merge. Now, the same scenario takes less than 15 seconds to complete it. So, it's 500 times faster.

#### All platforms - PlasticX

All platforms - PlasticX: added tooltip to Branch Explorer

Branches, changesets and labels on the Branch Explorer now have a tooltip which looks something like this:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/90eac2c9b11e35e4f9d0bd7386ad8f751e957a40cf031d33aa182f518fe48b9b.png)

Clicking the links on the tooltip will open a diff of the specified branch or changeset.

#### All Platforms - Command-Line Client

All Platforms - Command-Line Client: New information to display on revision history command

A new option has been added: --limit. It displays the N last revisions regarding the specified items. If N is bigger than the number of available revisions, it will display the existing ones (limit will take no effect); if N = 0, it will display every revision; if N \< 0  the displayed list will be empty; if 0 \< N \< numRevisions will display the N most recent revisions, sorted by date and changeset id.

For example:

```console
cm.exe hist foo.c bar.c --format='{path}: {itemid}' --limit=5
```

Will display the path and itemid regarding the last 5 revisions of foo.c and bar.c

```console
foo.c: 8
foo.c: 16
bar.c: 12
bar.c: 13
bar.c: 15
bar.c: 21
bar.c: 24
```

Note that, in the example, foo.c only has 2 revisions.

#### All platforms - PlasticX

All platforms - PlasticX: Changes in Semantic Merge Window

We changed the Semantic Merge Window icon, now the window will now show legacy Semantic Merge tool icon

We added MinWidth and MaxWidth properties to the window

#### All Platforms - Command-Line Client

All Platforms - Command-Line Client: New information to display on revision history command --format

Two more fields have been added to the revision history command in order to display information such as the revision size in bytes and the revision hash code. The --long option will also regard these new fields.

Now it is possible to use both `{size}` and `{hash}` in order to display that information along with the --format option.

For example:

```console
cm.exe hist ./dir/foo.c bar.c --format='{path}: {size} bytes ({hash})'
```

Will display the review history of both foo.c and bar.c files, outputting the item id, the size of the file at each specific revision and, in between parenthesis, the hash code identifying the content of each revision.

```console
./dir/foo.c: 5 bytes (RKaq9oJlXsU2xCXiO7zSjg==)
./dir/foo.c: 15 bytes (qNJWW77XzCApIMdT13jzkw==)
./dir/foo.c: 203 bytes (NnqIk33R+eUMaewTjAVrqQ==)
bar.c: 2031 bytes (aaHWt78weCApIMHa53jz22==)
```

In addition, the --long format will also display the new fields:

```console
cm.exe hist bar.c --long
```

Will display something like the following, considering bar.c file had only 1 revision:

```console
REVISION HISTORY OF C:\wkspaces\default\bar.c

--------------------------
Revision spec: bar.c#cs:1
Located on branch: /main
Created: 9/27/2022 17:53
Revision type: txt
Changeset number: 1
Owner: newuser
Repository: default
Server: localhost:8084
Repository spec: default@localhost:8084
Data status: Available
Item ID: 21
Item path or spec: bar.c
ItemSize: 2031
Item hash code: aaHWt78weCApIMHa53jz22==
Comment: bar.c now is managing HTTP connections
```

#### All Platforms - PlasticX, GluonX

All Platforms - PlasticX, GluonX: Application Zoom Support

You can now apply a zoom level to the whole application!

Change it via the ⋮ (triple vertical dot) menu on the top right corner -> Zoom or by pressing Ctrl + Plus, Ctrl + Minus, to increase or decrease the application zoom.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/f41e3b772332c6a93b6ef1aae65252e1f52ecf298d3a6947e9091154b9cf98a9.gif)

#### All platforms - Plastic

All platforms - Plastic: Added text editor options.

Now, the diff tool and the merge window have new options to customize the text editors. Those options allow to:

* Show/hide the tabs and the whitespace.

* Show/hide the line ending (EOL) characters.

* Convert tabs to spaces while editing.

* Customize the indent size (tab size) to 4 or 8 characters.

* Add column rulers.

Demo:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/5d1a26dcf554e668ddd0bbdde6569bebd41a1fa9112e9149953e255ed29949b6.gif)

#### Command-line client

Command-line client: New env variables in codereview edit

Previously there was no way to create a \[before | after]-editreview trigger and retrieve

information about what editing was  being done: the assignee or the status or both of them.

Now there are two new environment variables related to \[before | after]-editreview triggers:

PLASTIC\_REVIEW\_ACTION: edit assignee or edit status or both separated by ';')

PLASTIC\_REVIEW\_ACTION\_INFO (detailing "previous value" "->" "new value" for the assignee, the status or both, separated by ';').

Mind that only when editing the code review from the CLI both fields can be edited at the same time.

For instance, if you have a script which is dumping the environment variables passed as arguments to an output file (DumpEnvVars.exe), the following trigger creation:

```console
cm trigger create before-editreview before-editreview-trigger "C:\wkspaces\scripts\DumpEnvVars.exe -env=PLASTIC_REVIEW_ACTION;PLASTIC_REVIEW_ACTION_INFO C:\wkspaces\outputs\before-editreview-trigger-result.txt" --server=localhost:8084
```

And you do a code review edit like this one:

```console
cm codereview -e 19 --status="Under review" --assignee="Michaella"
```

The script would write a file with the following content:

```text
PLASTIC_REVIEW_ACTION = edit status;edit assignee
PLASTIC_REVIEW_ACTION_INFO = Rework required->Under review;Thormund->Michaella
```

### Bug

#### All platforms - PlasticX

All platforms - PlasticX: Error in skip merge tracking

An unexpected error was displayed when skipping merge tracking in diff window for big number of differences (>50).

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: fixed issue selecting damaged image files in Pending/Checkin Changes Views.

When selecting a damaged image file in Pending Changes/Checkin Changes Views, if the user had selected previously another image file, image panel still showed to the user the last viewed image, we fixed this issue.

#### All platforms - PlasticX

All platforms - PlasticX: Attributes panel resizing

The attributes panel was not showing the relevant info, the attribute name, when resizing. A fix has been added in order to adapt panel items sizes proportionally to the available space/width when resizing the panel horizontally.

#### Server

Server: The REST API to download revisions had a memory leak.

The endpoint to download a file revision content (api/v1/repos/repName/revisions/revId/raw) had a memory leak when the '?version=2' query parameter was specified.

We already fixed a memory leak related to this endpoint in the version 11.0.16.7372, but a different one still happened. Fixed.

#### All platforms - Semantic Merge

All platforms - Semantic Merge: Fixed diff color palettes for the dark theme.

The colors used to display differences were unsuitable for the dark theme (they had low contrast). Now it's fixed. This is how it now looks:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/c9d47430aa22e6fba2319f4841ff1025c5d3cd80dbd91fa43906acca2f748829.png)

#### All platforms - PlasticX

All platforms - PlasticX: Fixed empty buttons in pending changes

There was an issue with the "Save" and "Discard" buttons that appear in the pending changes view when you modify a file from Plastic. Sometimes, when changing the selection of the file, these buttons appeared without any content, until moving the cursor over them. We fixed this issue, and now the buttons work as expected

#### Windows - PlasticX

Windows - PlasticX: Fixed issue when opening files with custom tool

When trying to open a file with a custom tool from the workspace explorer on Windows, there was an exception preventing the new process from starting. We fixed this issue, and now the custom tool launches as in the other platforms

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Preview was being calculated even when it's not visible.

We optimized the Details Panel behavior. Now, the app will only calculate the Preview data when the panel is visible to the user.

#### All platforms - PlasticX

All platforms - PlasticX: Fixed issue when requesting credentials

When you try to perform an action on a server for which you don't have valid credentials, we show a dialog asking you to authenticate. There was a bug that made this dialog appear multiple times overlapped. We fixed this issue and now the dialog only appears once

#### All platforms - PlasticX

All platforms - PlasticX: Merge view issues

Avoid error loading conflicts from a merge in Merge view and converted multiline texts in one single line for Comments column.

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Tool command not properly refreshed

In Preferences window when the Diff or Merge Tools were opened, the Tool command text field was not properly updated with the current selected tool command line.

#### All platforms - PlasticX

All platforms - PlasticX: Fixed DNS error for cloud.plasticscm.com

We fixed an issue in the Plastic onboarding where a DNS error was shown after creating a new organization. This issue only appeared for new accounts that didn't have any organizations and created a new one after the sign up.

#### All platforms - PlasticX

All platforms - PlasticX: Help not displayed for empty list of code reviews

The help panel wasn't displayed after clicking the Help button in "Code Reviews" view when the list was empty, now the general query views help will be shown for this case.

#### All Platforms - PlasticX

All Platforms - PlasticX: SemanticMerge hangs

An issue has been fixed in which when resolving a conflict with the argument "--process-all-merges"

#### macOS - PlasticX

macOS - PlasticX: Fixed loading of Polarion extension

When trying to load the Polarion issue tracker exception in macOS, an error was thrown because a missing dependency. We fixed this issue, and now you can use the extension on macOS as in the other platforms

#### All platforms - PlasticX

All platforms - PlasticX: Fixed issue when showing merge tracking colors

We fixed an issue with the merge tracking colors menu, which was only visible when diffing branches that didn't have xlinks.

Now it's also available for diffing changesets and labels, which can contain changes in xlinks

#### All platforms - GluonX

All platforms - GluonX: Details Panel didn't clear data when no row was selected in Checkin View.

We fixed an issue in the Checkin View Details Panel. Now, the app will always clear previous data when no row is selected or if the Checkin View is empty.

#### All platforms

All platforms: TLS1.3 temporarily disabled.

TLS1.3 is not supported on Windows 10. We identified some software that enables and forces it through registry editing, forcing Plastic SCM secure connections to use it, and failing to connect both to Enterprise and Cloud servers.

#### All Platforms - PlasticX

All Platforms - PlasticX: Incorrect theme on ⋮ (options menu)

An issue has been fixed in which sometimes would show the incorrect theme selected on ⋮ (options menu) -> Theme.

#### All platforms - GluonX

All platforms - GluonX: Hide open repository button

In order to avoid opening not loaded repositories, the open repository button won't be available from Home view in Gluon app.

#### All platforms - Plastic

All platforms - Plastic: Allow restoring default font in the text editors.

The dialog that allows changing the editor font didn't show the "Select default font" button. Now it's fixed:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/1608a61d69d1b1013521054c5ba89dcb7acded9811bb9593991494e397fb9c67.png)

#### macOS - PlasticX

macOS - PlasticX: Fixed hang when discovering new servers

There is an option when adding new accounts to auto discover Plastic servers in the local network. If the discover operation is cancelled while it is running, the application hangs, and needs to be killed.

We fixed this issue, and now the operation can be cancelled without issues

#### All platforms - Plastic

All platforms - Plastic: Fixed syntax lines are not colored sometimes.

In some scenarios, some lines were not colored when loading a file in the diff viewer. Now it's fixed.

#### All platforms - Plastic

All platforms - Plastic: The diff scrollbar was not visible under some circumstances.

A recently added option in the diff viewer that allows scrolling below the document caused the scrollbar not to be visible sometimes. Now it's fixed.

#### All platforms - Plastic

All platforms - Plastic: resolved issue where long running merge processes could accumulate on the server

The Plastic client checks the server for incoming changes in some operations that can affect them. This can trigger the server to calculate a merge. If this calculation took a long time, the calculation would be triggered again by other operations and these processes could accumulate, pointlessly using server resources.

We fix this by ensuring that the calculation will not be requested if another calculation is already in progress.

#### Windows - PlasticX, GluonX

Windows - PlasticX, GluonX: Dynamic Workspaces checkbox not visible

The dynamic workspaces checkbox visibility status was not properly refreshed from Create Workspaces dialog. When "plasticfs" process is running the checkbox should be visible so the user can create a dynamic workspace, otherwise it shouldn't be available.

#### MacOS - PlasticX

MacOS - PlasticX: Cannot switch to plastic from gluon

An issue has been fixed that prevented switching from gluon to plastic via the '...' menu.

#### Windows - PlasticFS

Windows - PlasticFS: msys2 redirection overwrites files (append mode)

Trying to concatenate content through shell redirections overwrote files due to a bug related to opening files in append mode:

```console
$ echo -e "This is an apple" >> test.txt
$ echo -e "This is a pen" >> test.txt
$ cat test.txt
This is a pen
le
```

This has been corrected:

```console
$ echo -e "This is an apple" >> test.txt
$ echo -e "This is a pen" >> test.txt
$ cat test.txt
This is an apple
This is a pen
```

#### All platforms - PlasticX

All platforms - PlasticX: Error loading branch explorer

Fixed error trying to load a workspace in partial mode in Branch explorer view.

#### All platforms - PlasticX

All platforms - PlasticX: Error reviewing image files

In the code review window, an error was raised trying to select image files, it's because the diff icons bar is not available for image files, the file differences couldn't be loaded properly, and an error message was displayed. Now it's fixed.

#### All platforms - Plastic

All platforms - Plastic: Go to moved code buttons not drawn.

If you selected "Go to moved code" in the diff viewer, then the action buttons in the destination are not drawn until you mouse-over the column. Now it's fixed.

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Infinite progress after creating a shelveset

There was an issue when creating a shelveset in Plastic and Gluon, where the progress would spin forever when choosing to undo the changes after creating the shelve

***

## 11.0.16.7504

> **Note:**
>
> **Public** | 2022-10-13

### New

#### All platforms - PlasticX

All platforms - PlasticX: Edit accounts

We added a new option in the home panel that lets you modify on-prem servers accounts. When using it, you will be able to authenticate again to the server, updating the stored credentials


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/ba53347d9b5066b8455f3f7b090eb2038187617830e7eec3fe9e1ff5440f5359.png)

#### All platforms - Command line client

All platforms - Command line client: Now you can list group members from cm!

Doing so is easy: just specify the group name in the `--group` option of the `cm listusers` command.

If a group is a member of a group, the command will solve its users recursively too.

So take this scenario as an example: Users 'sergio' and 'brenda' are part of the Developers group. User 'paula' is part of the QA group, and so is the Developers group. So QA users are 'paula' and 'Developers', and 'Developers' users are 'sergio' and 'brenda'. By solving groups recursively, the command output will look as follows:

```text
> cm listusers --group=QA myorg@cloud
sergio
brenda
paula
```

#### All platforms - PlasticX

All platforms - PlasticX: License notifications

Plastic will display user notifications about the license status. An information message will be shown when the current license is going to expire indicating the remaining days and how to renew it. On the other hand, when the license has been expired then an error message will be shown.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/57acca1c55e2475bcc83afac304f7be3718641f338ff1ef8ef81688669a6d91d.png)


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/f277ca6f9e624b1237863b20607bf94bedb54d6221edda5454e9754bd5ca66ea.png)

For extended trial licenses the notification panel will allow users to start the license registration process, so users could extend their licenses for 30 days.

#### All platforms - Command-line client

All platforms - Command-line client: Better cm status with tables!

Modern times arrive for our command line, with a much better way to display workspace changes: `cm status --pretty`

Check how it looks like now:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/14e93ef237bd96cdb1349f7ddefe1d02d1b4ef7571fd77e2d11a1b10cbefa59c.png)

And compare with how it looked like before:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/4ed268ad2bf12784b968c956301c231dc7a67d65f0a37615b7dff22e0ebfb226.png)

Now also check how it looks like in Windows Terminal:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/7b4968e57029ecc61a8beb54fc975900f6075d6f0fc65aa079dd93f47793090f.png)

And the good old cmd.exe:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/f1c20329480a253b3727da464d7b8959e3481cd05cb6e530935127d0950c45e5.png)

Enjoy!

#### Command-line client

Command-line client: Apply only the desired changes from a shelve

From now on, the cm allows you to choose which changes do you want to apply from a shelve. You no longer need to apply all the changes done on the shelve.

You can see which changes are going to apply by the shelve without applying them using:

```console
$cm shelveset apply sh:2 --preview
The file /q3radiant/Z.CPP#sh:2 was modified on source and will replace the destination version
The file /ui/hud2.txt#sh:2 was modified on source and will replace the destination version
```

You can apply only the desired changes indicating the changes paths to apply:

```console
$cm shelveset apply sh:2 /ui/hud2.txt
The file /ui/hud2.txt#sh:2 was modified on source and will replace the destination version
Merging c:\tmp\quake\ui\hud2.txt
The revision c:\tmp\quake\ui\hud2.txt@sh:2 has been loaded
```

### Bug

#### All platforms - PlasticX

All platforms - PlasticX: Fixed issue obtaining changesets from old server

Some time ago we modified a method in the Plastic server that was called from the client. This change made the client throw an exception when trying to execute the method on an old server:

"The method GetChangesetsInfoByNumber is not supported"

We fixed this issue, and now the client will work with modern and old versions of the server.

#### All platforms - PlasticX

All platforms - PlasticX: Fixed issue with code review comment selection

Opening a code review comment for a file which had additional changes made to it after the code review comment was created was not working correctly. We fixed this.

We also corrected an issue where items in the file list were not being marked as viewed when they should have been.

#### All platforms - PlasticX

All platforms - PlasticX: Non-editable username when authenticating in Name working mode

When signing in to a server using the Name working mode, you were able to modify the username used to authenticate. This was wrong - on Name working mode the username must always be taken from the system

#### All platforms - PlasticX

All platforms - PlasticX: Diffs multiple selection issue

When an item is marked as viewed it changes the text style from bold to normal. The diffs list must mark items as viewed just when a single selection is done, items won't be marked as viewed on a multiselection.

#### All platforms - PlasticX

All platforms - PlasticX: Annotate View splitter

We fixed the splitter in the Annotate View: the metadata column will expand correctly and won't show blank space. We also set minimum and maximum width properties to the metadata column.

***

## 11.0.16.7468

> **Note:**
>
> **Public** | 2022-10-06

### Bug

#### All platforms - PlasticX

All platforms - PlasticX: Disable context menu items for empty lines in the "Annotate" view.

Trying to execute some menu context menu actions for empty lines In the Annotate view, caused the UI to show an error, but now it's fixed. When a menu item cannot be executed, it's just disabled.

The affected menu items are:

* Diff branch

* Diff changeset

* Annotate before these changes

* Show semantic history

* Add diff selection,

* Diff with previous selection

#### Windows - PlasticX

Windows - PlasticX: Exception when diffing symlinks

An exception that occurs when trying to diff a symlink file on windows has been fixed, along with a bunch of minor visualization bugs.

#### macOS - PlasticX

macOS - PlasticX: fixed assembly load error when configuring issue trackers

PlasticX was looking in the wrong place for issue tracking extensions, resulting in an error when opening the Issue trackers pane of Preferences. We fixed it to check the correct path.

***

## 11.0.16.7460

> **Note:**
>
> **Public** | 2022-09-29

### New

#### Linux, macOS - PlasticX, GluonX

Linux, macOS - PlasticX, GluonX: removed "Switch to Legacy GUI" option for Linux and macOS users

This release marks the end of support for the legacy (pre-avalonia framework) Linux and macOS GUIs for all users.

We have removed the "Switch to Legacy GUI" option for Linux and macOS users, and soon their executables won't be included in the package


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/cada7577e78f08856f974ec12c3979e8286c77dc666db78a9f08c126ef2fe9c9.jpg)

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Added merge tracking colors to diff view

When you are seeing the differences of a branch with merges, sometimes is difficult to know where each change came from. To make this easier, we added colors to the diff view to differentiate between source, destination, and conflict changes. You can modify these colors and even show/hide them depending on what you want to see.

This feature was already available for Windows users in the legacy GUI. Now it's available in all platforms in the new Plastic GUI.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/944c8010701cf0b8ae3619bda632563370c49b9ce65c984d30b1d1ac376852ed.png)

#### All platforms - PlasticX

All platforms - PlasticX: Added ESC key close shortcuts in overlapped Browse Repository and Changesets Views

We've added new ESC key close shortcuts in the following overlapped views in PlasticX

* Browse Repository

* Changesets (only when Changesets View is called as a overlapped View)

#### All platforms - Command line client

All platforms - Command line client: 'cm rm controlled' now removes items in block.

Removing a controlled item involves a few operations: locking the workspace, starting a new workspace transaction, look for the item in the tree metadata, removing said node, checking out the parent (if necessary), removing the content from disk (if necessary), and finally commiting the transaction and unlocking the workspace.

Before, the command `cm rm controlled` would do all of these steps for each item, regardless of them belonging to the same workspace. This would incur on a big overhead when trying to delete many items in a row.

Now the command deletes all items belonging to the same workspace in block.

However, this forced some changes in how `cm rm controlled` reports removed items through standard output. If you use this command in an automation script or plugin, and you don't use the `--format` or `--errorformat` flags, you might need to consider these changes.

Consider the following scenario: we are going to delete a controlled directory (src), a private file (ignore.conf), and a file that is outside of the workspace (README.txt). This would be the output in previous Plastic SCM versions:

sergio:/wkspaces/Project$ cm rm ignore.conf src ../README.txt

/wkspaces/Project/ignore.conf is not in a workspace.

Item ./src/ has been removed

/wkspaces/README.txt is not in a workspace

Now paths are reported in the following order: first, all the paths that were correctly removed. Then, all the paths that were skipped because of an error (for example, the item not being in a workspace). Finally, all the paths that were skipped because they are not in a workspace. Now we also always use the item's full path:

```console
sergio:/wkspaces/Project$ cm rm ignore.conf src ../README.txt
Item /wkspaces/Project/src/ has been removed.
/wkspaces/Project/ignore.conf is not in a workspace.
/wkspaces/README.txt is not in a workspace.
```

We honor the behavior of the `--format` and `--errorformat` flags.

```console
sergio:/wkspaces/Project$ cm rm ignore.conf src ../README.txt --format="{0} - DELETED" --errorformat="{0} - NOT DELETED"
/wkspaces/Project/src/ - DELETED
/wkspaces/Project/ignore.conf - NOT DELETED
/wkspaces/README.txt - NOT DELETED
```

We also honor the command's exit code. Before, if an item could not be removed for whatever reason, command's exit code was 1. The same behavior applies here.

#### All Platforms - PlasticX

All Platforms - PlasticX: Merge files from command line with XMerge

You can now use PlasticX for merging and diffing any files using XMerge!

A quick way to get started is to run PlasticX with a single argument, xmerge. As shown below:

* For Windows:

  ```console
  [plastic|winplasticx] xmerge
  ```

* For MacOS:
  ```console
  plasticgui xmerge
  ```

* For Linux:

  ```console
  plasticgui xmerge
  ```

Now, some quick examples

* To diff two files:

  ```console
  [plasticgui|winplasticx|plastic] xmerge -s=fileA.txt -d=fileB.txt
  ```

* To merge two files a common base file is also required:

  ```console
  [plasticgui|winplasticx|plastic] xmerge -s=fileA.txt -d=fileB.txt -b=base.txt
  ```

In order to determine if a merge was successful, PlasticX will return 0 or 1 as the application exit code. 0 means a merge was successfully performed and the result file has been save, 1 means that a merge has been aborted or not saved.

#### All platforms - PlasticX

All platforms - PlasticX: Open Merge view from command line

The merge-to view could be open from command line to solve the branches merge conflicts, it can be invoked like this:

```console
plasticx --merge=/main/task001\@myrep\@myserver:8084 --to=/main\@myrep\@myserver:8084
```

This command has 2 arguments, `--merge` for indicate the source branch and `--to` for indicate the destiny branch in merge.

When this command is executed from command line a new plastic window will be displayed with the merge view opened, and the merge conflicts will be shown in this view.

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Proxy configuration

When connecting to an on-premises server for the first time, we added an option to use a proxy. This option was already available on Windows, and now you can use it on the three platforms from the new GUI:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/65785b817a700a805f8c3ec69519cebd3c8752bdc5a9cf6afec00afcac5c0439.png)

Learn more about proxy servers here: [https://www.plasticscm.com/documentation/administration/plastic-scm-version-control-administrator-guide#Chapter4:Usingaproxyserver](https://www.plasticscm.com/documentation/administration/plastic-scm-version-control-administrator-guide#Chapter4:Usingaproxyserver)

#### All platforms - PlasticX

All platforms - PlasticX: show code moves between files in diff window

Plastic can detect code refactors where code blocks have been moved from one file to another.

When you diff a branch or changeset a notification will be shown in the Diff window if such a refactor is detected.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/742e92398820e4d2c0aded91e10cae04d93be1a9fba7e4f4695643fb15bc24b3.png)

Clicking the Show button will group the changes related to the refactor in the diff window file list.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/dc848c4f004b674d06b9d960871af323142f699b96740ed1595fe585bc7f9eba.png)

If the diff contains a large number of items, rather than run a potentially long calculation, we show a notification with the option to run the refactor analysis.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/36ea451743b8f8d122e7542f5209db8a563dfa53585e30076401503e5bb848b9.png)

### Bug

#### Server

Server: The REST API to download revisions could fail for encrypted data

Version 2 of the endpoint to download a file revision content (`api/v1/repos/repName/revisions/revId/raw?version=2`) fail to download an encrypted big file content (over 4MB) when the file content cannot be compressed.

#### All platforms - PlasticX

All platforms - PlasticX: Allow annotate on a not checked-in file

An exception was thrown when trying to annotate a not checked-in file, now an empty annotate view will be displayed.

#### Server

Server: Avoid reloading users & groups multiple times

The users and groups are reloaded periodically from the authentication provider. But due to an error, on each periodic reload, the reload was done multiple times. Now it's fixed

#### All platforms - PlasticX

All platforms - PlasticX: Mark viewed files on Comments selection

Some files from diff items panel were not marked as viewed in code review window when a comment was selected from comments list, this files came from the diffs for a previous revision. It has been fixed and now all the files will be marked as viewed when any new comment selection were done.

#### All platforms - GluonX

All platforms - GluonX: fixed Gluon plastic links to a file not opening

In some cases, when trying to open Gluon plastic link to a file, Gluon tried to open that file in a new workspace and failed, we fixed this issue

Also, we improved the design of "Get Plastic link" button in Gluon Workspace Explorer Details


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/f2639516192be677278b6200c0081625e76f78536c4dbd1d323306970ef356ea.jpg)

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Cannot configure a custom diff tool

The file type extension data (FileType) has been removed from configuration (client.conf) for diff tools with custom extension.

#### All platforms - PlasticX

All platforms - PlasticX: Fixed layout when searching in Browse Repository

Search panel in Browse Repository expanded when searching, we fixed the layout

#### All platforms - PlasticX

All platforms - PlasticX: Fixed duplicated control is Issue trackers preferences

In Preferences -> Issue trackers, if the user clicked twice "Bind to this issue tracking system", the controls duplicated in the dialog, we fixed this issue

***

## 11.0.16.7419

> **Note:**
>
> **Public** | 2022-09-22

### New

#### All platforms - DevOps

All platforms - DevOps: TrunkBot learnt to pass user defined branch attributes to the CI plan.

Now it is possible to configure the TrunkBot mergebot with a list of user-defined branch attribute names. When TrunkBot processes a branch, it will calculate the branch attribute values and it will forward them to the underlying Continuous Integration plan, triggered to build & test the branch being processed, as key-value parameters (attribute name-attribute value).

See how this feature looks like:

1. First of all, let's open the configuration of an instance of a TrunkBot mergebot, "CI Integration" section.

   Here you can see new text fields where you're able to specify a comma-separated list of branch attribute names to forward to both the build & test plan and, if defined, to the "after-checkin" plan if the branch is successfully merged.


   **Screenshot:**
   ![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/0cd0d8f8a5a60ea83623e8912c6ac844869d8e414af15e70e07e867bfdcbfddb.png)

   In the example above, 'product-type' and 'arch' attributes will be considered for the build & test plan, whereas the after-checkin plan will consider the 'deploy-type' attribute.

   > **Note:**
   >
   > The TrunkBot won't create any of these attribute names in the repository automatically. This has to be done by the user or the repository administrator.

   These attributes can be easily created throught the attributes view of the Plastic SCM GUI:


   **Screenshot:**
   ![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/108468110d466f57fe91458d4e055bca6dfe64b899dad33b4b0d7bbadb255249.png)

2. Now let's create some changes in the repo monitored by the TrunkBot instance. Let's create branch 'main/scm003', submit a new changeset, set some values for the user-defined branch attributes we're using in this example, and finally mark the branch status as 'resolved', enabling the TrunkBot instance to process it and try to merge it to the specified 'trunk' branch: the 'main' branch:


   **Screenshot:**
   ![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/fed1861ac0dbb80375d06de5d927464b134128ae95d95f7173bb39e6559a90d9.png)

3. We're using Jenkins in this example as the CI system. When the TrunkBot processed branch 'main/scm003', it forwarded the 'product-type-to-build' and 'arch' attributes and their values on 'main/scm003' to the execution of the 'build-tools-plan' we have defined in Jenkins (see step #1):


   **Screenshot:**
   ![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/4063f37dd262597725e252b53fbff41cbab0ab31b96f956cb63ead895fa23fc0.png)

   This way, the 'build-tools-plan' is able to read these properties and customize its steps depending on these values, if required.

4. Let's suppose the 'build-tools-plan' ran successfully for 'main/scm003' and the branch got merged into the defined 'trunk' branch: the 'main' branch:


   **Screenshot:**
   ![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/ee38fa08a16d9829bc6633de3d79c95794ba4f763e508339ebde6bd24c2fc052.png)

   We also defined a plan to run after a successful merge of a branch in the "CI Integration" section of the TrunkBot instance (see step #1).

   In this example, it will pick the 'deploy-type' attribute value of branch 'main/scm003' just merged, and will forward it to the plan to run after checking a branch in, named 'deploy-tools-plan':


   **Screenshot:**
   ![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/ed818002b859f5567a5f3bf2e966d2cea463320f9bcad4a3ff7e408d98d8c98c.png)

> **Note:**
>
> * In case the attribute does not exist, or a branch does not have such attribute set, the trunkbot will create and sent the property with empty value to the CI plan anyway. Each CI system may behave differently when a plan is triggered and a property is set to an empty value.
>
> * Also notice that Jenkins will add the `PLASTICSCM_MERGEBOT_` prefix to the property name (the name of the attribute).

#### Windows - PlasticFS

Windows - PlasticFS: New WinFSP version improves Python support

Some Python scripts failed when trying to solve virtual paths with Pathlib.

```console
> solvemypath.py
[WinError 1005] The volume does not contain a recognized file system.
```

This happened as the implementation relies on the Windows Mount Point Manager to solve the path, but WinFSP didn't support registering virtual file systems in that facility... until now!

```console
> solvemypath.py
Full path: C:\Workspaces\DynamicWk
```

To use this feature, you will need to uninstall WinFSP, reboot your computer and start PlasticFS as usual. The new version of the WinFSP driver will be automatically installed.

### Bug

#### Windows - PlasticFS

Windows - PlasticFS: New WinFSP version fixes Visual Studio "Go to file"

Using "Go to file" (Ctrl+T) in Visual Studio didn't work reliably inside dynamic workspaces, not returning results or even freezing the IDE from time to time. Now it works consistently.

To use this feature, you will need to uninstall WinFSP, reboot your computer and start PlasticFS as usual. The new version of the WinFSP driver will be automatically installed.

***

## 11.0.16.7411

> **Note:**
>
> **Public** | 2022-09-19

### New

#### All platforms - PlasticX

All platforms - PlasticX: Filter code reviews

A new combobox has been added to Code reviews view in order to apply filters to the displayed items list.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/2c71ada7e801e813eb8c443545563a9f32cb7785b6b6b313b139670a528d509f.png)

#### All platforms - PlasticX

All platforms - PlasticX: Added "Close merge view and open pending changes view" preferences option

We have added a new option in Diff and Merge Preferences: "close merge view and open pending changes view when a merge is completed"

If this option is checked, when a merge is completed, the Merge View will be

automatically closed and Pending Changes View will be shown, improving the user workflow.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/c9c232dd4a98f3317900968139a71f08ec07f7ef92adfe94e376c8ac0e0babd7.jpg)

Also, when a merge is completed and this new option is not checked, we modified the "merge finished" message adding two links in order to open Pending Changes View or open Preferences Window.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/b1a32477aedd3a7ff382ec495418a5d1c8be084c4e9a73acdbec4963ee6c9c2e.jpg)

#### Command-line client

Command-line client: Creating workspaces is simpler than ever

Until now, to create a workspace using cm you had to give it a name and indicate the path and the repository:

```text
$ cm wk mk project ./project rep:project@mydefaultserver
```

Often, the three are named the same. For that reason, now it is possible to use a shortened syntax:

```text
$ cm wk mk project
```

This command will create a workspace infering the name and path from the repository spec you pass as argument!

And advanced use of the command also allows you to specify a different server:

```text
$ cm wk mk project@myorg@cloud
```

### Bug

#### All platforms - PlasticX

All platforms - PlasticX: Fixed exception when showing semantic history for item checked out

Showing the semantic history (available from the Annotate view) for an item checked out no longer causes an error.

#### Server

Server: Fixed access violation exception

The server could crash due to an access violation exception sending the response to the client on a corner case of concurrent usage of the client's connection.

#### All platforms - PlasticX

All platforms - PlasticX: Disable History menu option for added files

We disabled the History menu option in the Workspace Explorer for added files because added files have no history.

***

## 11.0.16.7388

> **Note:**
>
> **Public** | 2022-09-07

### New

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Mark unviewed diffs in bold

The list of differences in Diff window will display viewed items in normal text style and non viewed in bold text style. It'll apply just to the path column for each difference from the list.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/52f92c301c986198e606273651c14d38949e94ca33fdc2befa7dc54025785a2c.png)

#### All platforms - PlasticX

All platforms - PlasticX: Added new semantic history view

We added a new view to PlasticX: the semantic history. From this view you can see the history of individual methods or classes inside each file. This view was available on the Windows legacy GUI, and now you can use it from every platform in PlasticX. Check it out:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/ae2dc691f38e6e756b6b4dc99b4dde42834ed20e27005054937296f6d2440d83.png)


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/425c2315e198a018dbfc606226b13422f06fb3cd7a98044a166b9a32da238db7.png)

#### All clients

All clients: GitSync doesn't fail anymore if it cannot access to a revision data.

GitSync won't fail anymore if for whatever reason it can't access the contents of a given revision. It will add an empty revision in the Git package instead.

This way we allow syncing with Git even if an old revision is not present due to any old or weird issue.

#### All platforms - PlasticX

All platforms - PlasticX: Code review skip merge tracking

A new button to group the diffs by merge has been added to Code review window. This button will be available only when the selected branch/changeset has merges in the differences list.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/5dd47659b7d4ce6ed9b1511f72ab840f110ae455febfe15130d3d7e613e87eb3.png)

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Added "Scan network" button

Added a new "Scan network..." button below the server entry, when connecting to an on-premises server. This button will show a dialog that allows you to easily find Plastic servers in your local network


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/685578936d17d88b4fba397d9537404bcd94f8a53340ff0ce2ca37b45f22cdbc.png)


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/37f0b1122961cff4883dbe620d3c27e8c46375a2661b9681f33af73f3a9511ff.png)

### Bug

#### All platforms - PlasticX

All platforms - PlasticX: Issue trackers not configurable without workspace

A created workspace is required to configure any issue tracker from the Preferences window. For this reason the view controls will be hidden and a message will be displayed when no workspace is loaded.

#### All platforms - PlasticX

All platforms - PlasticX: Linked tasks browse broken

Browse button from Linked tasks panel in Pending changes view didn't open the correct task URL in the web browser. The task Id format has been fixed in order to open the URL properly.

#### Server

Server: The REST API to download revisions had a memory leak.

The endpoint to download a file revision content (api/v1/repos/repName/revisions/revId/raw) had a memory leak when the '?version=2' query parameter was specified. Fixed.

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: only show empty comment warning if user wants it

We were failing to save your preference for not re-showing the empty comment warning if you cancelled the warning dialog.

#### PlasticX

PlasticX: Unexpected directory conflicts after solving selected file conflicts

Unexpected new directory conflicts appear after merging the selected file conflicts. Now, after merging the selected files only the pending file conflicts remains.

Also, the check-in of the previous merge result, with the reappearing directory conflicts, could fail with an item loaded twice error. Now that the merge is working properly the result can be checked in properly.

#### All platforms - PlasticX

All platforms - PlasticX: fixed exception scrolling diffs in diff window

We have fixed an unexpected exception that appeared when scrolling Xlinks diffs in diff window

Also, we will always show in normal font style the merge and changes categories


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/eb9181971ce5d3be4ad03b04e5c4aeffd47e6c7546778115212b05f32fc7216b.jpg)

#### All platforms - PlasticX

All platforms - PlasticX: Restore a in-progress merge on restart

Now when Plastic is restarted, if there are pending links, the in progress merge is restored. In this case, the Merge tab will be available from the startup and the loaded merge will be the last in-progress merge before the app is closed.

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Fixed authentication issue when changing the server working mode

If you had a stored profile for a server, and the server changed its working mode, you were not able to update the the existing profile to authenticate to the server.

We fixed this issue - now when the server changes the working mode, the old profile is removed, and we ask for new credentials to save a new profile

#### All platforms - PlasticX

All platforms - PlasticX: Fix code review comment navigation.

When double-clicking a code review comment in the Code Review Window, the left textbox didn't navigate to the proper line, so the DiffViewer scroll got de-synchronized. Now it's fixed.

#### All platforms - PlasticX

All platforms - PlasticX: Linked tasks panel layout improvements

Some layout adjustments has been included to improve Linked Tasks panel.

A new button has been also added to Pending changes view at the top header area. This button "Show Tasks" will allow to show/hide the Linked Tasks panel when it'll be available.

Linked tasks are available when an issue tracker was previously configured with bind by changeset option selected.

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Made dialog button order consistent

Some 3 button dialogs had the Cancel button in the wrong position. We reviewed all dialogs and made the button order consistent with platform guidelines in each case.

#### All platforms - PlasticX

All platforms - PlasticX: fix exception when subtractive merge returned no results

We have fixed a exception when you tried a subtractive merge that returned no results (for example, a subtractive from a not connected branch)

#### All platforms - PlasticX

All platforms - PlasticX: Fixed dynamic view location issues

There were some issues with the location of the dynamic views, such as the annotate, history or semantic history, where they appeared in the wrong place of the screen, or partially cut.

We fixed this issue, and now all these views are shown filling all the available space, no matter where they where opened from

***

## 11.0.16.7359

> **Note:**
>
> **Public** | 2022-09-01

### New

#### All platforms

All platforms: Moves with changes are now reflected by after-checkin and after-clientcheckin triggers

When you modify a file on the top of moving it, both changes are reflected in the workspace status and in the Pending Changes view. However, the checkout was not notified to triggers:

```console
# E.g.: after-checkin (server-side) trigger
MV "/ALICE.TXT" FILE#br:/main;changeset:16@rep:Project@repserver:Organization@cloud ->"/BOB.TXT" FILE#br:/main;changeset:15@rep:Project@repserver:Organization@cloud
```

We added that information to the input data:

```console
# E.g.: after-checkin (server-side) trigger
MV "/ALICE.TXT" FILE#br:/main;changeset:16@rep:Project@repserver:Organization@cloud ->"/BOB.TXT" FILE#br:/main;changeset:15@rep:Project@repserver:Organization@cloud
MV "/BOB.TXT" FILE#br:/main;changeset:16@rep:Project@repserver:Organization@cloud ->"/BOB.TXT" FILE#br:/main;changeset:15@rep:Project@repserver:Organization@cloud
```

### Bug

#### Linux - PlasticX

Linux - PlasticX: Open with dialog was not displayed.

The native file dialogs (Open with, Save the file, etc ...) were not correctly displayed on Linux boxes. Now it's fixed.

***

## 11.0.16.7348

> **Note:**
>
> **Public** | 2022-08-25

### New

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Delete current workspace could throw non-controlled exceptions

If the user deleted the current workspace in use in the GUI (using the GUI or delete workspace command), further operations with that deleted workspace would throw non-controlled exceptions that could close the program; we fixed this issue.

#### All platforms - PlasticX

All platforms - PlasticX: Show warning when the user tries to delete changeset involved in a pending merge

We now show a warning message and stop the delete changeset operation if you try to delete a changeset that is the source of a pending merge link. We do it because deleting the merge source puts you in an invalid state where you cannot later check in the merge.

#### All platforms - All client applications

All platforms - All client applications: Upgraded interface assembly consumed by issue tracker extensions

We support connecting any client application to an issue tracker to retrieve a user's list of assigned tasks, create a proper branch, or open a task in the issue tracker.

We provide built-in connectors for many issue trackers, such as Jira, Bugzilla, etc.

And we also published an interface so you can write your own connector for a custom issue tracker. This interface is located at `issuetrackerinterface.dll` file, in the `client` binaries folder of a Plastic SCM installation.

We've upgraded the  `issuetrackerinterface.dll` and now is compiled in `netstandard2.0` (instead of `net framework 2.0`). This will enable further improvements in the issue tracker subsystem of plastic.

Just in case you have a custom extension compiled in net framework 2.0, you will have two options:

* Upgrade your custom extension and compile it in net framework 4.0 or above

* Use the legacy `issuetrackerinterface.dll` compiled in net framework 2.0, located at `client/extensions` directory of a windows installation of Plastic SCM

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: added warning for an empty check-in comment

We have added an optional warning if you accidentally try to check in with no check-in comment. It looks like this.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/96ad05f11165099834a3cbb4cc462b9f8a5b9bef9e8fe173de266cfa466c8548.png)

You can activate it in Preferences -> Comments:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/858f375258bd2713c3ddd4b9497d60b3169afaf39d9e6d44f95a80d0381a56de.png)

#### Command-line client

Command-line client: 'cm history' shows if the revision was archived.

The 'cm history' command shows whether the revision's data was archived. It adds a new entry for each history entry specifying the data status. The possible values are 'Available' or 'Archived'. The value is empty for the moved/removed history entries.

Default output:

```console
D:08/09/2022 10:26 CS:1   B:/main
DATA:Archived
C: my comment
```

Long output (--long):

```console
...
Repository spec: repo@server:8087
Data status: Available
```

Xml output (--xml):

```console
...
<RepositorySpec>repo@server:8087</RepositorySpec>
<DataStatus>Archived</DataStatus>
```

#### All platforms - PlasticX

All platforms - PlasticX: Branch filtering on new history view

Further improving the new history view, a dedicated branch filtering popup has been added!

Filtering by one or as many branches as needed is now possible. You can try it out by viewing the history of any file or directory and clicking the 'branch' button near the search bar.

### Bug

#### All platforms - Plastic, PlasticX, Gluon, GluonX

All platforms - Plastic, PlasticX, Gluon, GluonX: pending changes check status preserved when Incoming changes applied

Previously, pending changes you had unchecked in the Pending Changes view (or Check-in view in Gluon) were being checked when Incoming Changes were viewed or applied. We now preserve your chosen checked state.

Note, that merging can still check previously unchecked items. This is because all items involved in a merge must be checked in together. To help you avoid issues trying to check in a subset of a merge we automatically check all the items involved in the merge.

#### All platforms - PlasticX

All platforms - PlasticX: Create button not refreshed in create branch dialog

The Create button status needs to be refreshed depending on the content of the text fields of the current displayed tab in "Create branch dialog". When an issue tracker was previously configured, two ways of creating a new branch will be available, Manual and From task. The branch name will be mandatory to create a new branch.

#### Command-line client

Command-line client: A workspace created with `cm wk mk` unexpectedly points to the default repository

When creating a workspace there is no need to specify a repository. A default one will be selected instead.

If a non-existent repository is specified when creating a workspace, the command was silently falling back to picking a default repository. This behavior was misleading.

Now, the command just fails and shows an error:

```console
> cm wk mk Project ./Project ProjectTYPO@thecompany@cloud
The specified repository couldn't be found: ProjectTYPO@thecompany@cloud.

> cm wk mk Project ./Project Project@thecompany@cloud
Workspace Project has been correctly created
```

#### Command-line client

Command-line client: The `cm wk mk` subcommand does not always accept the 'rep:' prefix

Creating a workspace pointing to a repository specified with the `rep:` prefix failed silently if a server address was not specified.

```console
> cm wk mk Project ./Project rep:project@thecompany@cloud # This works.
> cm wk mk Project ./Project rep:project # This fails silently.
> cm wk mk Project ./Project project # This works even so.
[console]

Now the second command works as you would expect.
```

#### All platforms - PlasticX

All platforms - PlasticX: corrected GUI hang when switching during Undo

Attempting to switch to another workspace while a long Undo operation was in progress would cause the GUI to hang.

Now, if an operation is in progress, we inform the user and don't allow the switch until the operation has been completed.

#### All platforms - PlasticX

All platforms - PlasticX: Fixed changeset -1 exception

There was an exception thrown when selecting the Home changeset in the Branch Explorer when there was a diff view in the background.

We fixed this issue

#### All platforms - PlasticX

All platforms - PlasticX: exception thrown if pending merge source changeset not found

If the source changeset of a pending merge link could not be found (probably because it was deleted), an exception was thrown in the Pending changes view. Now, in this case, we display some helpful text in the merge link description, letting you know you will not be able to check in the merge (because the source changeset is missing).

#### All platforms - PlasticX

All platforms - PlasticX: Hide the "add" repository button before org is created

Fixed issue that allowed the user to click 'add' repository button. The 'add' repository button has been hidden when a user is not part of an organization yet.

#### Windows - PlasticX, GluonX

Windows - PlasticX, GluonX: allow file rename changing case only

We fixed the validation in the Rename dialog of the Items view to allow renames that only change the case of the name.

***

## 11.0.16.7303

> **Note:**
>
> **Public** | 2022-08-11

### New

#### All platforms - GluonX

All platforms - GluonX: Remark current loaded revision

The current loaded history revision will be remarked in bold style in the History Panel.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/3cb8baf4b92c2a2d0a965b82f64c71932af2e1c372817f7d8ed96a93ae83aef6.jpg)

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Issue tracker configuration

A new preference option has been added to the Preferences window for the issue tracker configuration.

Some features will be available if this preference is enabled:

* Create new branch from a existing task.

* Checkin operations record attached to tasks.

* Automatic status transitions.

* Display linked tasks in pending changes view.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/9ba5f3e0b73f48e77f74437e9d99f0ae21b6cf9b3057fdcf16dac448a26393ba.png)

#### All platforms - Server

All platforms - Server: GUIDs storage is 5 times faster

We improved the performance of reading GUIDs in our Jet backend. Now reading a GUID is 5 times faster than before!

Taking into account that many objects in the Plastic SCM data model contain a GUID, almost all read operations (and especially those in bulk) will take advantage of this improvement. But not only that, the new method of reading GUIDs does not allocate any memory at all - so we also (slightly) reduced the memory footprint of the Plastic SCM Server. Good news overall!

#### Command-line client

Command-line client: GetWorkspaceFromPath command now displays workspace type

Workspaces can be of two different types: regular or partial (Gluon). In addition to that, Windows users can choose between static or dynamic workspaces (virtualized with PlasticFS).

Now, the GetWorkspaceFromPath command can display this extended information if the option --extended is provided to the command:

```console
cm gwp C:\mygluonwk\ --extended
mywk C:\mygluonwk mymachine dca2b0fc-07ce-434f-949a-009d8c62034d partial dynamic
```

It is also possible to get this information through the --format option by using the 'type' and 'dynamic' keywords:

```console
cm gwp C:\mysourcewk\ --format="Name: {wkname} | Type: {type} | Is: {dynamic}"
Name: mysourcewk | Type: regular | Is: static
```

More information in the help (cm \[gwp | getworkspacefrompath] --help)

#### Server - DevOps

Server - DevOps: Code Review gating for Multiliner mergebot

The built-in multiliner-bot is now able to use embedded Plastic code reviews to drive the CI/CD lifecycle.

Enable the following "Process reviewed branches only" toggle button in multiliner-bot configuration to activate this feature:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/7168355a7b93c51226b10b0e48def467a88239cb41a0907366b3b15a1b0a78cf.png)

The feature works as follows:

* When a code review of a tracked branch(\*) is created, or its status changes, the task branch is queued in multiliner-bot.

* Then, multiliner-bot will eventually dequeue this task branch. But before continue its processing in the CI cycle, multiliner-bot will check whether there is at least a "Reviewed" code review for this branch. Otherwise, the branch processing is skipped, and the branch is queued again at the end of the queue.

* If there are more than a code review linked to this task branch, all of them need to be approved before processing the task branch.

* If all the code reviews are approved, the task branch continues its processing by the multiliner-bot:

  1. If the merge fails (manual conflicts detected), or the branch build in the configured CI system fails, the status of the linked code reviews of the branch will be set to "Under review".

  2. If the merge succeeds and the branch build succeeds too, the task branch is merged, and the "status" attribute of the branch is set to "merged" (these fields must be filled in the multiliner-bot configuration).

((\*) tracked branch: those that starts with the configured branch prefix in multiliner-bot config)

#### All platforms - PlasticX

All platforms - PlasticX: Checkin & Undo shortcuts

Checkin and Undo operations from pending changes view will be now available using key gestures, Alt+I for Checkin button and Alt+U for Undo button.

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Fix date formatting for languages different than English

When the system language was not set to English, we were forcing some date and number fields to the English formatting. We did this to fix some issues with Turkish characters.

We addressed each issue individually, so now we can take the system language for date fields again, instead of forcing it to English.

#### All platforms, PlasticX, GluonX

All platforms, PlasticX, GluonX: Various diff improvements

* Updated the syntax highlight grammars to the latest version, which brings the latest language features for major languages like C#, Python, Java, etc...

* fixed some syntax highlight exceptions registered in the log coloring some documents.

* Improve the behavior when changing a file in the pending changes view or the diff view. Previously, when selecting another file, the diff viewer scrolled to the first line, and then it went to the first diff. Now the first line is not scrolled. See before and after:

Before:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/6664983c33b9427205e1d69c51aefddb378dbb1456de5d315c146e7d38e3159c.gif)

After:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/74360f77c2f88e90622aa1eedafc64df4078ebedc1d6a9a1119877d80c6c301a.gif)

#### All platforms - PlasticX

All platforms - PlasticX: Create top-level branch

A new menu item has been added to branches context menu in Branches view and Branch explorer. This new option will allow to create new branch in level 0, a top-level branch.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/978392997a7a01981891f632263a56e0f5a702c61e0e24718d88a89c922daa88.png)

#### All platforms - PlasticX

All platforms - PlasticX: Color changesets by server in the Branch Explorer.

We ported the "Color changesets - replication source" functionality, already existing in the Legacy GUI, to the new GUI. It allows to set up custom colors for all the changesets belonging to a certain server.

This is how it works:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/7c20c49901807f8b5dcd994606ae78098670c2d99f5b7bb1a6a7d9845ae2cd53.gif)

#### All platforms - PlasticX

All platforms - PlasticX: Color changesets by user in the Branch Explorer

We ported the "Color changesets - users" functionality, already existing in the Legacy GUI, to the new GUI. It allows to set up custom colors for all the changesets created by a certain user.

This is how it works:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/d095debcc789cec60627843cd5db9a1263dd8e380cca24c7d7789ebeba0448ba.gif)

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Automatically detect local server

When configuring Plastic for the first time, if you select the on-premises mode, you will see an empty server field that you must fill with the server you want to connect to.

Now, if there is a local server running on a well-known port, this field automatically filled:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/a11c522dbcca080679a1948635d802e4ef40b09f548fb7c49a852d461887a69f.png)

#### All platforms - PlastiX, GluonX

All platforms - PlastiX, GluonX: Object GUID in Diff window

The object GUID has been included in diff window as diff metadata.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/a867c2ecef7ee0ffb98d9f2fe64c67cf4fddab18867bbb4742062778f28929ca.png)

### Bug

#### All platforms - PlasticX

All platforms - PlasticX: Branch name shown incorrectly when branch explorer filtered

We fixed an issue where the branch name was being displayed incorrectly in the Branch Explorer when you filtered the view to show just the current and related branches. (You can do this from the context menu on a branch, from the "Branch Explorer" submenu).

#### macOS - PlasticX

macOS - PlasticX: Show History shortcut hides app

Cmd+H shortcut is currently used by the system to hide apps, so it can't be used in PlasticX to show the history view.

For this reason, the "Show history" shortcut has been changed to Cmd+Y and the Redo shortcut has been also changed from Cmd+Y to Shift+Cmd+Z.

#### Command-line client

Command-line client: PlasticLink arguments wrongly processed as option arguments

If you use a PlasticLink as argument for the command line, the command failed with a cryptic error message:

```console
> cm attribute set att:CodeReviewLink@MyGame@MyServer:8087 br:/main/CoolFeature plastic://MyServer:8087/repos/MyGame/code-reviews/9999

attribute: Unexpected option --MyServer:8087/repos/MyGame/code-reviews/9999
```

Now the command does not fail.

***

## 11.0.16.7274

> **Note:**
>
> **Public** | 2022-08-04

### New

#### All platforms - PlasticX

All platforms - PlasticX: Auto-refresh Sync to Cloud view after opening

In Plastic X, when selecting "Sync to Cloud" view, the view was not refreshed. Now it's automatically done, helping to improve the workflow.

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Removed Plastic SCM prefix from release name

All Plastic releases have a release name, which is a song name and the artist. This name can be seen in the about window.

A few releases back we added a "Plastic SCM" prefix before this name. We removed it, so now you see just the name as before.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/31c50082235c1ae62fa6a0348f8586ad3bf5ffddc8aede4eeb1c3e8cb7e048ca.png)

#### All platforms - PlasticX

All platforms - PlasticX: Improved history view

We re-wrote the history view from scratch. The new history view has the following features:

* Improved the revision list layout. Now it optimizes the horizontal space. We also display the avatar for the revision creator (note that it displays the [Gravatar](https://gravatar.com) image when the username is an email).

* Setup a new panel that allows displaying diffs/annotate for the selected revision.

* Support history for text, image, binary, and directories revisions.

* Note that in this version of the history view, we display the changeset comment for the moved and removed revisions (previously the comment was not displayed).

* We also improved the way we display the changeset comments in the details panel. Long comments are split in two chunks, and the second chunk can be expanded/collapsed.

See it in action:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/08a3e8b88f986eb3c9e7fba75f01172f22c586b2160d4b74fadeb7ca073a666d.gif)

And now for images:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/cb3073555f9ad173ff0fcf5dac087795779ecd021c5627af1b7c9df490df12a9.gif)

Note that you can still use the legacy history view by setting up the following setting in the plasticgui.conf file, placed in the user config folder:

```text
UseLegacyHistoryView=True
```

#### All platforms - PlasticX

All platforms - PlasticX: Added Merge options

We brought back this feature from the legacy GUI to PlasticX

This feature will allow PlasticX users to define merge options for each merge:

-Merge from both contributors, or only from one side

-Automatic merge conflict, or manual merge conflict (always launch the merge tool event with 0 unsolved conflicts)

-Ignore Merge Tracking

-Advance options: ancestors


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/4134ae0b3c3c6c187c50adce141e6d1f852a0ff8aea60c53ca54b46956f7e387.jpg)


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/04c8534efe2a79345e9ebd5acd2c1f9810f6c01a486bb617c66779f329032498.jpg)

#### Command-line client

Command-line client: Annotate command options update

The command to annotate files (cm annotate) was using, among others, the --ignore option, with (eol | whitespaces | "eol\&whitespaces" | none) as possible values. Due to other commands are using another interface, it has been decided to homogenize them all. Now, --ignore will become --comparisonmethod and its regarding options will be (ignoreeol | ignorewhitespaces | ignoreeolandwhitespaces | recognizeall).

NOTE:

Old syntax will be deprecated, but it is still working. Therefore, scripts or other programs using this command will continue working as before. Despite of this, we encourage to update its usage to the new interface. More details in the command help.

Example: in case we want to annotate a foo.c file which has been created and checked-in on a unix system and after that some changes were done and checked-in on a Windows platform, we might want to ignore the EOL:

```console
cm annotate foo.c --comparisonmethod=ignoreeolandwhitespaces
```

#### Command-line client

Command-line client: Diff command options update

The command to show differences (cm diff) was using, among others, the --ignore option, with (eol | whitespaces | "eol\&whitespaces" | none) as possible values. Due to other commands are using another interface, it has been decided to homogenize them all. Now, --ignore will become --comparisonmethod and its regarding options will be (ignoreeol | ignorewhitespaces | ignoreeolandwhitespaces | recognizeall).

NOTE:

Old syntax will be deprecated, but it is still working. Therefore,  scripts or other programs using this command will continue working as before. Despite of this, we encourage to update its usage to the new interface. More details in the command help.

Example: in case we want to check a foo.c file which has been created and checked-in on a unix system and after that some changes were done and checked-in on a Windows platform, we might want to ignore the EOL:

```console
cm diff rev:foo.c#cs:1 rev:foo.c#cs:2 --comparisonmethod=ignoreeol
```

#### Command-line client

Command-line client: Shelveset apply command options update

The command to apply shelvesets (cm shelveset apply) was using the --comparisonmethod with (ignoreeol | ignorewhitespaces | ignoreeolwhitespaces | notignore) as possible values. Due to other commands are using another interface, it has been decided to homogenize them all. Now, "ignoreeolwhitespaces" will become "ignoreeolandwhitespaces" and "notignore" will become "recognizeall".

NOTE:

Old syntax will be deprecated, but it is still working. Therefore, scripts or other programs using this command will continue working as before. Despite of this, we encourage to update its usage to the new interface. More details in the command help.

Example: in case we want to apply a shelveset and, when comparing actual with previous contents for merging the changeset, we might want to ignore the EOL and whitespaces:

```console
cm shelveset apply sh:2 --comparisonmethod=ignoreeolandwhitespaces
```

#### Command-line client

Command-line client: Diffmetrics command options update

The command to print metrics of differences between two revs (cm diffmetrics) was using, among others, the --ignore option, with (eol | whitespaces | "eol\&whitespaces" | none) as possible values. Due to other commands are using another interface, it has been decided to homogenize them all. Now, --ignore will become --comparisonmethod and its regarding options will be (ignoreeol | ignorewhitespaces | ignoreeolandwhitespaces | recognizeall).

NOTE:

Old syntax will be deprecated, but it is still working. Therefore, scripts or other programs using this command will continue working as before. Despite of this, we encourage to update its usage to the new interface. More details in the command help.

Example: in case we want to see how many added, modified and deleted lines in a foo.c file and compare them with its version from a different branch, recognizing all, including EOL and whitespaces:

```console
cm diffmetrics foo.c#cs:2 foo.c#br:/main/scm007 --comparisonmethod=recogniseall \
    --format="There are {0} changed, {1} added and {2} deleted lines."
```

#### Server

Server: Server backups no longer block read-only web calls

The web calls were not allowed while the server was running a backup. Now the web calls that are read-only calls are allowed during the backup. This applies to the web client, the web admin, and also mergebots.

#### Command-line client

Command-line client: After-checkin trigger payload: move operations were not displaying move reference information

Previously, after-checkin triggers were generating a JSON content with several variables. One of these variables is named INPUT, which contains information about the changes checked in. These changes might be one of the following: AD, CH, DE and MV, indicating the type of operation which was performed regarding one item. MV operation has a particularity, as it involves not only one file but two.

Now it has been fixed and displays both source and destination of the moved file in the proper order (src->dst).

For example, let's imaagine we have a workspace with the following controlled contents: "./foo.c" and "./FooFolder" and we perform the following operations:

```console
cm mv ./foo.c ./fooFolder/foo2.c
cm ci -c="foo belongs to fooFolder"
```

The INPUT variable will now display:

```console
 'INPUT':'CH \"/\" DIR#br:/main;changeset:59@rep:default@repserver:localhost:8084
CH "/fooFolder" DIR#br:/main;changeset:59@rep:default@repserver:localhost:8084
MV "/foo.c" FILE#br:/main;changeset:2@rep:default@repserver:localhost:8084->"/fooFolder/foo2.c" FILE#br:/main;changeset:2@rep:default@repserver:localhost:8084'
```

As you can see, there are two changes corresponding the changes in the root directory and the change in the fooFolder and a MV operation, which now details both source file and destination file of that operation, separated by a "->" operand and both displaying all the information re the change.

Therefore, for the move operation, the specification will become:

```text
status src_item_path item_type#br:branch;changeset:cset_id@rep:rep_name@repserver:server->status dst_item_path item_type#br:branch;changeset:cset_id@rep:rep_name@repserver:server
```

IMPORTANT NOTE: it is possible that users already parsing this output will perceive their parsers start to fail. We are sorry for any inconvenience this might cause. We balanced different options and finally decided to give you more information for you to use, despite of it might be needed to retouch existing parsers at this moment.

### Bug

#### Command-line client

Command-line client: Changelist wrongly removed by cm status with filter

```console
cm status --changelist --controlledchanged
```

Running the command from above, non-persistent changelists only containing local changes are expected to be omitted from output. However, the command was actually erasing the changelist. Now, doing the same preserves the changelist intact.

#### All platforms - PlasticX

All platforms - PlasticX: Fixed error in branches explorer dialog

Opening the branches explorer dialog would, in some cases, for example performing the "Merge from this changeset to ...", trigger an unexpected exception. We fixed that.

#### All platforms - PlasticX

All platforms - PlasticX: Focus items list after search

In Plastic X, using the items search and selecting a search result using the "Enter" key, caused the items list to not grab the keyboard focus. Now it's fixed.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/cafb9a515a3585be73a7e0e48babaa98a243f9b4fef4e7455f851ffd17c7b928.jpg)

#### All platforms - GluonX

All platforms - GluonX: Fixed comments textbox losing the focus.

After doing a check-in or undo checkout operation in GluonX, a bug prevented the check-in comments textbox to preserve the keyboard focus while typing. Quite annoying. Now is fixed.

#### All platforms - PlasticX

All platforms - PlasticX: Fixed exception in workspace explorer

There was an exception that was thrown sometimes while navigating through directories in the workspace explorer. This issue is now fixed

#### All platforms - PlasticX

All platforms - PlasticX: Null exception closing shelves view

In PlasticX, there was a rare issue where a null exception message could appear when closing Shelves View, we fixed this issue

***

## 11.0.16.7248

> **Note:**
>
> **Public** | 2022-07-28

### New

#### All platforms - PlasticX

All platforms - PlasticX: New Details panel in Workspace Explorer

The Details panel has been added to the right side of the Workspace Explorer in PlasticX. This panel contains the image preview and properties of the selected item in the workspace tree, so it will be refreshed on every new selection. It is a collapsible panel, by default it's collapsed and can be expanded by using the new button "Show details" at the top right.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/e325004f40a2464006a89ca17c94051992b64b404fa0d6382a77d1e38acac021.png)

#### All platforms - PlasticX

All platforms - PlasticX: Added comments auto-text feature

We added comments auto-text feature to Plastic. This allows the user to use predefined variables (Date, UserName, Branch Name) or a custom string in the comments textbox in Pending Changes view:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/739779d51a84b978e6f310b03cbbf191dc8efdc57955fcf2dccfc89f1cc16e13.jpg)


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/8e941defb667713048504d8d56416415c0aeef4588af190757ea3e3cc9332263.jpg)

Also, the icons in Preferences Window were updated.

#### Command-line client

Command-line client: Upgraded changelist command now allows specifying files for the name and the description.

Changelist command has been upgraded with new verbs for management ("create" and "delete" substituting "add" and "rm"). Now it is possible to use new options in changelist commands: --namefile, --descriptionfile, --newnamefile. These options allow to replace the literals used to specify the name of the changelist or its description and to use a path to a file containing the changelist name or description instead.

For instance

```console
cm changelist add "Physics-related changes" "Changes related to the game world environment and the implemented physics"
```

Could be updated to

```console
cm changelist create "Physics-related changes" --descriptionfile="desc.txt"
```

Or also could be updated to

```console
cm changelist create --filename="name.txt" --descriptionfile="desc.txt"
```

Or you could also rename a pre-existing changelist with something like the following:

```console
cm changelist edit --filename="name.txt" rename --newnamefile="newname.txt"
```

Bear in mind:

* Old command syntax is still working but tagged as deprecated and the help has been updated. If you have automated scripts using this command, they will work, but we encourage you to update those and test the new amazing functionalities

* You can still use the same literals or use the options, whatever the combination that best suits your needs (options + literals, literals + options, all options, all literals).

* The --namefile and --newnamefile options do not allow invalid files or content (non-existing file, empty or multilined texts); in addition, if an non-existing file is supplied to --descriptionfile, it will also fail, but no content validity will be done.

#### DevOps

DevOps: Remove branches from Trunkbot processing queue

If you accidentally set the status attribute to a branch, your Trunkbot might enqueue it and eventually merge it.

Before, you could remove it from the processing queue by changing the value of the attribute to something else. Now, removing the attribute from the branch will have the same effect.

#### Server

Server: Edit cset comment now checks branch perm

When you edit the comment of a changeset, the "change comment" permission needs to be set in the branch that contains the changeset.Before this change, the repo permission was checked, which wasn't as good solution as checking the permission in the branch.

#### All platforms - PlasticX

All platforms - PlasticX: Remark current working item

The bold text style has been applied to the current working item, for the "Name" column of the Changesets and Branches views tables, in order to indicate which item on the list is currently loaded.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/6df24b859f2d4f36be5bccf398ed6274e5241ea652b4b0118ed31b3cb57b63ff.png)

#### Command-line client

Command-line client: Configure data encryption for remote servers

As the owner of a Plastic server, you can configure encryption when trying to pull data from repository inside a remote encrypted server for the first time.

This was true for the Plastic GUIs, but now it is also possible within the command line:

```console
> cm pull br:/main@donuts@homer@cloud dotnuts@marge:8084
...
The 'homer@cloud' source server requires data encryption.
Your server (aka 'marge:8084') is not yet configured to handle encrypted data from it.

Remarks:
* Be very careful with the encryption password; it's the only way to decrypt your data on 'homer@cloud'.
* If you're decrypting data and you enter a wrong password, the data will fail to decrypt and you will have to edit cryptedservers.conf on your server to fix it.
* Be careful to use the same password (encryption key) company-wide to work with 'homer@cloud'. Otherwise, data will be encrypted differently in each server.

Enter a password to generate the encryption key (leave empty to cancel):
***********

Encryption configuration added for server 'homer@cloud'.
...
```

### Bug

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: GUI asked for credentials unnecessarily

When adding a new account belonging to several organizations, the UI unnecessarily asked for credentials for every organization belonging to that account. Now it's fixed.

#### All platforms - PlasticX

All platforms - PlasticX: CPU remains active after a replication operation

When finishing a replication operation, the progress panel caused the UI to consume CPU even though the panel was not displaying any animation. Now it's fixed.

#### Windows - Client zip bundle

Windows - Client zip bundle: The command-line bundle some plugins such as Jenkins used lacked the zlib64.dll library. It is now fixed.

This affected only machines without a full Plastic SCM set up on them. Machines that had at least a setup with the complete Plastic SCM client or server did not encounter this issue, as at least one copy of zlib64.dll was in the DLL search path.

#### WebAdmin

WebAdmin: Fix mergebots daily report

Opening the daily report of a mergebot throws a "something went wrong error". This happened since 11.0.16.7118. Now it's fixed.

#### All clients

All clients: Private files should not be cloaked

Before, private items could be matched by the cloaked filters set up in the 'cloaked.conf' file, so they didn't appear as simple private changes. From now on, only controlled items can be regarded as cloaked.

To keep the old behavior, you can also add the filters to your 'ignore.conf'.

#### Command-line client

Command-line client: Ls --tree for a file was not returning its path

When running the `cm ls` command to get the content from a repository tree (`--tree` option) and using a file as an argument, the `{path}` format field was empty:

How it was before:

```console
cm ls /api.cs /bar.txt --tree=10@adventure@LOST:8087 --format="{path}|||{owner}"
|||james
|||james
```

Now it is evaluated to the file path, as expected:

```console
cm ls /api.cs /bar.txt --tree=10@adventure@LOST:8087 --format="{path}|||{owner}"
/api.cs|||james
/bar.txt|||james
```

#### Windows - PlasticFS

Windows - PlasticFS: Workspace directory already exists

Before, opening a dynamic workspace when PlasticFS is not running could create an spurious workspace directory. When restarting, PlasticFS was forced to set it aside in order to mount the workspace:

```text
Directory moved from mount path

Tried to mount at path 'C:\workspace', but it was not empty. Existing directory renamed as 'C:\workspace~moved0'.
```

Now Plastic behaves more kindly when the workspace is still not mounted on its path.

#### All platforms - PlasticX

All platforms - PlasticX: Null exception closing differences view

In PlasticX, when opening more than one Differences View in Pending Changes View, closing a second or latter Differences View threw "a unexpected error has occurred" message

We fixed this issue

#### All platforms - GluonX

All platforms - GluonX: Fix in History Panel

If you selected a directory item or a item with no history (for example, a recently created file), and you tried to right-clicked in the history Panel, a exception appears. This issue is fixed.

***

## 11.0.16.7211

> **Note:**
>
> **Public** | 2022-07-21

### New

#### All platforms - PlasticX

All platforms - PlasticX: Added search textbox in MergeView

We added a new search textbox in MergeView, now it is possible to filter results


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/e5d2c49b8394bb1ffb77451c8b2d0830220c4f44f40718dae6c9383797b4fb5b.jpg)

### Bug

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Fixed issues with Turkish language

When the system language was set to Turkish, there was some issues like unhandled exceptions and bad arrangement of controls in the GUI.

We fixed this issue, and now everything works in the same way, regardless of the system language.

#### All platforms - PlasticX

All platforms - PlasticX: Fix subviews close button not visible

In PlasticX, when shrinking a subview (for example, annotate view), text header would eventually hide the close button

We fixed this issue in all subviews, close button won't disappear anymore. Also, text trimming was added to the header text.

#### Cloud Server

Cloud Server: Backups could block access to a repository indefinitely.

When the Plastic SCM server puts a repository in read-only mode before backing it up, it first stalls new write operations and then waits for already running write operations to finish. There is a long-running read operation that was wrongly identified as a write operation. Because that long-running operation could be active for days, the server was unable to finish the repository backup, while still rejecting new write operations.

This is now fixed. First of all, this long-running operation is now correctly identified as a read operation, so it doesn't prevent the backup of the repository. And to prevent something like this from happening in the future, the server now has timeouts when waiting for write operations to end.

#### Plastic, PlasticX

Plastic, PlasticX: Fixed users & group resolution on permissions working with multiple servers

The permissions dialog resolved the users and groups on the default server (the one used to configure the server). When the permissions dialog was shown from a different server and that server used an Active Directory authentication, the user and groups were not properly resolved. The SID was shown instead. Now, the users and group names are correctly shown.

#### All clients

All clients: find owner='me' condition works fine with multiple servers.

The shelve view didn't show your shelves in the workspaces that pointed to a different server than the default one (the default server is the one set in the client configuration). It happened only when the servers have different authentications.

The problem was that owner='me' condition was wrongly resolved against the default server. Now, it's properly resolved on the query target server.

***

## 11.0.16.7195

> **Note:**
>
> **Public** | 2022-07-13

### New

#### All platforms - PlasticX

All platforms - PlasticX: Expandable symlinks directories

Symlinks that points to a directory are now expandable from plastic itself!

This feature allows for easier navigation when the workspace contains symlinks. If a symlink points to a directory that is inside the workspace, it behaves like any other directory in the workspace, however if a symlink points to a directory that is outside the workspace, actions like "add to source control" are disabled for these files.

#### All platforms - Plastic, Gluon

All platforms - Plastic, Gluon: Better error handling for plastic links

When opening a plastic link, if there are any issues while processing it (because it's in the wrong format, or the server specified can't be accessed) we were just exiting the application without showing any error report.

We improved this behavior, and now we show a message with the reason why the plastic link could not be opened.

#### All platforms

All platforms: Added "Plastic SCM" prefix to assembly product name metadata

Before we were just setting the Release song name as "Product name" field in the assembly info of all the applications. Now we add the "Plastic SCM" prefix so some antivirus security reports using this "Product name" field can identify in a snap they belong to Plastic SCM.

### Bug

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Fixed selection in home view

There was an issue with the selection in the home view: when exploring the contents of a repository, if you selected a file or directory in the tree, and then clicked on a different repository, we were selecting a random item in the new tree.

We fixed this issue, and now when changing the repository, the tree selection is cleared

#### Cloud

Cloud: Fix the permissions issue with the case of the letters on the email

The permissions set for a single user were only working when the user logged in using the same case of the letters on the emails. For example, you allow [jame.webb@telescope.com](mailto:jame.webb@telescope.com) to see a repository, but when James logs in using [James.Web@telescope.com](mailto:James.Web@telescope.com) cannot see the repository. Now it's fixed.

#### All platforms - DevOps

All platforms - DevOps: Mergebots and plugs not running due to missing log4net dll

Recently we updated the log4net version to a more secure one. There were some related projects (mergebots) lacking that update which were failing. Now they are working as expected.

***

## 11.0.16.7176

> **Note:**
>
> **Public** | 2022-07-07

### New

#### All Platforms - PlasticX

All Platforms - PlasticX: Added context menu actions to Code Editor.

The Code Editors displayed in the DiffViewer, the File Content Viewer, Annotate view and the Merge view, now have available the following extra context menu actions:

* Undo

* Redo

* Copy

* Cut

* Paste

* Delete

* Go to line

* Select all

* Find


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/ee22d1a7e67b3e5626171cb88c3177f28817efcc71279e2b17b5a253aafd97ba.png)


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/bce70a0e94df5b0b511f21acf3f22cccca68e33a30073d9ae6d26cffccb79479.png)

Note that all the actions can be executed using the shortcuts.

Note that Undo/Redo/Cut/Paste/Delete actions are not available in the AnnotateView since it's always a read-only editor.

#### All clients

All clients: Only the \*.xxx rules are considered as extension rules.

Before, we considered the `.xxx` as an extension rule. This could lead to weird behaviors when trying to ignore a folder that started with `.` such as `.vs`.

Now, the `.vs` rule only matches files / directories with that exact name. It doesn't match paths with the `.vs` extension like `project.vs`

This applies to all files that use path rules (ignored.conf, cloaked.conf, etc.)

#### All platforms - GluonX

All platforms - GluonX: Added shelves view

Now you can create and view shelves from the Gluon GUI.

There is a new "Shelve" button in the "Checkin changes" view that lets you create a shelveset with your pending changes in the same way as you do in Plastic.

There's also a "Show shelves" button that opens a side view with the list of shelves, from where you can diff, remove or apply them to your current workspace.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/51286e0badf443074e68e9322cdc80095d97c3179d64a2b6d2b7436d9f0f0ed4.png)

#### Windows - Plastic, PlasticX

Windows - Plastic, PlasticX: auto-upgrade enabled for DVCS Edition

Auto-upgrade was previously only available for Enterprise and Cloud Edition. Now it is also available for Dvcs Edition. When a new version of the client is available, you will receive a notification in the help panel, with a link to initiate the upgrade.

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Improve readability of disabled text boxes.

The contrast between the background and the foreground colors was not good enough for disabled textboxes. Now it's better:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/b8e8802d94e48ba4378280215b7cd95644ce21f0dca33b37369acb541f8090d9.png)

#### All platforms - GluonX

All platforms - GluonX: Improve UI for recent check-in comments.

We moved the "check-in recent comments" button inside the textbox. This way we clear a bit the pending changes toolbar.

This is how it looks now:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/287352fee634769e1c92459ade9b1270b5fbafb996716990f91db4386db6864f.png)

#### Windows - PlasticX

Windows - PlasticX: Added diff arguments

In the legacy GUI you could open Plastic specifying arguments like the following:

```text
plastic --diffchangesetsrc=cs:437@validations@alvaro_test@cloud --diffchangesetdst=cs:436@validations@alvaro_test@cloud
```

When switching to the new GUI this feature was lost. We fixed this issue and now you can specify the arguments in both GUIs

#### All platforms - Server

All platforms - Server: Add extra protection to the server's Accept Loop.

The Accept Loop is the entry point of every single connection to the Plastic SCM Server. It is at the very heart of our custom network protocol (plasticpipe), and it can handle thousands of new connections per minute. But if the Accept Loop exits for whatever reason, the server is unable of accepting new requests. And a server unable of attending to new requests is useless.

Now the accept errors are handled and the loop is restarted if needed. If the accept loop cannot be started on 3 tries the server will exist in a safe way.

This is beneficial not only to your local and Enterprise Plastic SCM setups but also to the Plastic SCM Cloud Regional Servers.

### Bug

#### All platforms - PlasticX

All platforms - PlasticX: Query field not behaving properly

An issue was fixed that prevented correctly typing a new query into any query filter field after deleting all its content.

#### All platforms - PlasticX

All platforms - PlasticX: Annotate before these changes reported wrong revision.

Some customers reported that found a bug with "Annotate before these changes" button on PlasticX. Annotate before a given changeset, ended up annotating a wrong changeset. Now it's fixed.

#### macOS - PlasticX

macOS - PlasticX: Strikethrough lines were not visible.

The Mergetool displays some lines as strikethrough in the result text editor. A bug prevented those lines to be displayed as strikethrough in macOS. Now it's fixed.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/f84b3985f486950101b746b5cd37b2a4fe2804afd1275d98e291726dfb41c5ce.png)

#### All clients

All clients: Partial shelveset could fail to be applied when involving fs protection changes.

The 'partial shelveset apply' operation failed with an "Object reference not set to an instance of an object." error when these two conditions happened together:

1. The shelveset to apply contained fs protection changes for a directory.

2. This same directory contained controlled changes in the workspace before applying the shelveset.

Fixed.

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Preferences couldn't be opened

Allow to open the Preferences window when the client.conf file has missing the Diff or Merge tools.

***

## 11.0.16.7134

> **Note:**
>
> **Public** | 2022-06-30

### New

#### Command-line client

Command-line client: Shelvesets can be applied to partial workspaces.

Previously, it was not possible to apply a shelveset in partial workspaces (such as Gluon workspaces). Now we fully allow them (from the creation to the application).

```console
c:\wkspaces\partialwk> cm partial shelveset apply sh:2
```

The apply operation tries to apply all the shelveset changes in the workspace if possible. However, changes can be skipped if they are related to items that are not configured in the workspace (they are silently ignored) or if they collide with local workspace changes (they are properly reported)

```console
c:\wkspaces\partialwk> cm partial shelveset apply sh:2
The item won't be downloaded/moved because there is another item loaded in the same path: 'asset/texture/forest'. Please unload the item and retry the operation.
```

For more examples, you can check the help:

cm partial shelveset apply --help

#### Server

Server: Log the web call in the ChannelCall

Now the Server monitors and log all the web calls too, so you can see those call with their stats on the ChannelCall log as you see for any other Plastic call. See a new log sample:

```text
2022-06-03 10:27:23,722 INFO  ChannelCall - conn:     0 protocol:web          sec:none recb:       0|rect:   0|sentb:     309|sendt:   0|queuedt:       0|prt:       8|rq:  122|dest:   0|mt:       4|sert:   0|zip:   0|       127.0.0.1|user:tester|GET-/api/v1/repos/quake3/branches
2022-06-03 10:27:25,571 INFO  ChannelCall - conn:     0 protocol:web          sec:none recb:       0|rect:   0|sentb:     307|sendt:   0|queuedt:       0|prt:       3|rq:  123|dest:   0|mt:       1|sert:   0|zip:   0|       127.0.0.1|user:tester|GET-/api/v1/repos/quake3/main-branch
2022-06-03 10:27:27,287 INFO  ChannelCall - conn:     0 protocol:web          sec:none recb:       0|rect:   0|sentb:    6590|sendt:   0|queuedt:       0|prt:       3|rq:  126|dest:   0|mt:       1|sert:   0|zip:   0|       127.0.0.1|user:tester|GET-/api/v1/repos/quake3/branch/main/items/q3map
2022-06-03 10:35:29,707 INFO  ChannelCall - conn:     0 protocol:web          sec:none recb:       0|rect:   0|sentb:     729|sendt:   0|queuedt:       0|prt:    1532|rq:  210|dest:   0|mt:       2|sert:   0|zip:   0|       127.0.0.1|user:tester|GET-/api/v1/repos/quake3/changesets
2022-06-03 10:36:40,516 INFO  ChannelCall - conn:     1 protocol:plastic      sec:none recb:     111|rect:   0|sentb:       3|sendt:   0|queuedt:      16|prt:      11|rq:  216|dest:   0|mt:       2|sert:   0|zip:   0|       127.0.0.1|user:tester|CheckRepositoryExists
2022-06-03 10:38:11,002 INFO  ChannelCall - conn:     2 protocol:plastic      sec:none recb:     103|rect:   0|sentb:      85|sendt:   0|queuedt:       0|prt:       6|rq:  217|dest:   1|mt:       1|sert:   1|zip:   0|       127.0.0.1|user:tester|GetBranchInfoByName
2022-06-03 10:38:11,005 INFO  ChannelCall - conn:     2 protocol:plastic      sec:none recb:      18|rect:   0|sentb:      84|sendt:   0|queuedt:       0|prt:       2|rq:  218|dest:   1|mt:       0|sert:   0|zip:   0|       127.0.0.1|user:tester|GetChangesetInfoByNumber
```

See an example of how it was before:

2022-06-02 09:14:33,868 INFO  ChannelCall - conn:     9 protocol:plasticproto sec:none  recb:     912|rect: 134|sentb:    3645|sendt:   0|queuedt:       0|prt:     361|th:   65|dest:   0|mt:     158|sert:   0|zip:   0|cpu:       0|       127.0.0.1|user:tester|GetLockRule

2022-06-02 09:14:33,869 INFO  ChannelCall - conn:    11 protocol:plasticproto sec:none  recb:     809|rect: 162|sentb:    3612|sendt:   0|queuedt:       0|prt:     317|th:   67|dest:   0|mt:       2|sert:   0|zip:   0|cpu:       0|       127.0.0.1|user:tester|CheckRepositoryExists

2022-06-02 09:14:34,197 INFO  ChannelCall - conn:     7 protocol:plasticproto sec:none  recb:     913|rect: 126|sentb:    3742|sendt:   0|queuedt:       0|prt:     719|th:   63|dest:   0|mt:     489|sert:   0|zip:   0|cpu:       0|       127.0.0.1|user:tester|GetBranchInfoByName

2022-06-02 09:14:34,198 INFO  ChannelCall - conn:     5 protocol:plasticproto sec:none  recb:     793|rect: 447|sentb:    3680|sendt:   0|queuedt:       0|prt:    1269|th:   61|dest:   0|mt:     792|sert:   0|zip:   0|cpu:       0|       127.0.0.1|user:tester|GetRepositoryInfoByName

#### All Platforms

All Platforms: Command-line client

To list with the "--tree" option now displays the result regardless of some selector cannot be resolved

Previously, if several arguments were fed to the ls command in order to display their related trees, if one of them was not able to resolve the selector (i.e., there was a typo), the other trees were not displayed either. Now it is fixed and, regardless of the validity of each selector, it will display the results.

For example:

```console
cm ls -r /existingDir /unexistingDir --tree=br:/main@myrepo@localhost:8084
NOT_DEFINED cS63/xl4G39inoaBFDLNzQ==           0 13/06/2022 12:20 dir           2 /main                      20       19 /existingDir
NOT_DEFINED T/zbMvjqdPBx+XMMAbnrZA==         9 13/06/2022 12:20 txt           2 /main                      17       23 /existingDir/foo.txt
Can't resolve the selector for the item /unexistingDir
CommandResult 1
```

As you can see, the CommandResult will remain 1 (error), but the output will be dumped accordingly.

#### All platforms - all clients

All platforms - all clients: display language no longer overriden on APAC systems

Previously, when the configured language was English "en" but the system language was Chinese, Japanese or Korean, we would force the client to use the system language.

We no longer do this, and the configured language is always used.

#### Windows - Plastic, PlasticX

Windows - Plastic, PlasticX: Auto-upgrade enabled in Enterprise Edition for non-admin users

For a while the auto-upgrade feature has been available for all Cloud Edition users, but administrators in Enterprise Edition. We have now made auto-upgrade available for all users in all editions.

You will be notified of available version upgrades in the help panel:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/bd5b9f1f8e35472cfea360d3b0d2c6a944f2c11112000ca6e5e9318d176ea7fe.png)

If you click on the Download link, the installer will download:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/7824855e37a5216af6b3861d5ee2b0ae3a884640dae656911f07189ea9820777.png)

Simply click 'Restart and Upgrade' to install the latest version:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/7348b8070cb69ccc9677a4283db798147fad94833766da57b3863ef84e970d88.png)

#### Command-line client

Command-line client: Shelvesets can be deleted from partial workspaces.

Previously, it was not possible to perform a shelve operation in partial workspaces (such as Gluon workspaces). Now we fully allow every operation (create/apply/delete).

It is possible to delete an existing partial shelveset with shelveset id 3 doing the following

```console
c:\wkspaces\partialwk> cm partial shelveset delete sh:3
```

Mind there is no confirmation message. In case you would like to see it was deleted you can execute the following command to list every existing shelve created in the repository:

```console
c:\wkspaces\partialwk> cm find shelve
```

The creation subcommand (create | mk) is the default operation, so bear in mind that, if no subcommand is specified, it will try to perform the creation of a new shelveset.

For more examples, you can check the help:

cm partial shelveset --help

cm partial shelveset delete --help

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Added select all shortcut

Added a new shortcut to select all rows in the tables and trees where the multiple selection is allowed:

* Ctrl + A (Windows and Linux)

* Cmd + A (MacOS)

Due to conflicts with existing keyboard shortcuts, the following shortcuts have been modified:

* "Annotate" shortcut, replaced with Ctrl + T (Windows/Linux), Cmd + T in MacOs

* "Apply label to workspace content" shortcut, replaced with Ctrl + L (Windows/Linux), Cmd + L in MacOs

### Bug

#### All platforms - PlasticX

All platforms - PlasticX: Restored status bar position in switcher window

We restored the correct status bar position in switcher window, now it will appear at the bottom again


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/b105372cf9833afc01ffb158115e515451d41cb2593714f50757ff117c5176ea.jpg)

***

## 11.0.16.7110

> **Note:**
>
> **Public** | 2022-06-23

### New

#### Command-line client

Command-line client: Partial checkin allows --private option

Previously, it was not possible to use --private option in a partial checkin command. Now it is available and ready to use.

For instance:

```console
c:\wkspaces\partialwk> echo "return 1;" > foo.c
c:\wkspaces\partialwk> cm partial ci --private
The selected items are about to be checked in. Please wait ...
| Confirming checkin operation 11 bytes/11 bytes [################################] 100 %Modified c:\wkspaces\partialwk
Added c:\wkspaces\partialwk\foo.c
Created changeset cs:1@br:/main@repo1@localhost:8084 (mount:'/')
```

For more examples, you can check the help:

cm partial checkin --help

#### Command-line client

Command-line client: Shelvesets can be applied to partial workspaces

Previously, it was not possible to apply a shelveset in partial workspaces (such as Gluon workspaces). Now we fully allow them (from the creation to the application).

```console
c:\wkspaces\partialwk> cm partial shelveset apply sh:2
```

The apply operation tries to apply all the shelveset changes in the workspace if possible. However, changes can be skipped if they are related to items that are not configured in the workspace (they are silently ignored) or if they collide with local workspace changes (they are properly reported)

```console
c:\wkspaces\partialwk> cm partial shelveset apply sh:2
The item won't be downloaded/moved because there is another item loaded in the same path: 'asset/texture/forest'. Please unload the item and retry the operation.
```

For more examples, you can check the help:

cm partial shelveset apply --help

#### Windows - Plastic

Windows - Plastic: Enable changelists for locally modified files

You can now move locally modified (changed, moved, deleted) files into user-defined changelists.

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Enable changelists for locally modified files

You can now move locally modified (changed, moved, deleted) files into user-defined changelists.

#### All platforms - Command line client

All platforms - Command line client: Server connection profiles management reaches the command line!

We added the new `cm profile` command. It has three subcommands that allow you to manage your server connection profiles from the command line client.

The command 'profile list' lists the connection profiles you have configured:

```text
$ cm profile list
1  bananapi.codicefactory.com:8087       sergio  UPWorkingMode
2  udt://development_org@localhost:8089  sergio  UPWorkingMode
3  skullcito.codicefactory.com:9095      sluisp  LDAPWorkingMode
```

The 'profile list' command has several formatting options. Check `cm profile list --help` for further information.

The command 'profile remove' helps you to remove a configured connection profile. It works by specifying the profile index provided by `cm profile list`:

```text
$ cm profile remove 2
```

And 'profile create' helps you to create a new connection profile, either interactively or specifying all the necessary information through options:

```text
$ cm profile create
Enter server address: skullcito.codicefactory.com:9095
Enter credentials to connect to server [skullcito.codicefactory.com:9095]
User: sluisp
Password: *****************
Profile 'skullcito.codicefactory.com:9095_LDAPWorkingMode' correctly created
```

Check `cm profile create --help` for further information about the options you can use to create profiles.

#### Windows - PlasticX

Windows - PlasticX: PlasticX is now the official GUI on Windows

When you perform a clean installation of Plastic on a Windows machine, PlasticX will be the default GUI to open after the installation. Also, plastic links will be handled with this GUI.

When upgrading from a previous version, the last used GUI will still be the one that opens when running the Plastic executable

#### All platforms - PlasticX

All platforms - PlasticX: Case insensitive filter on home view

On the home view, the repository and workspaces filter are now case insensitive

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Unified Open Menu options in applications

We unified Open Menu right click context menu behavior across all views in PlasticX and GluonX


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/57e7f6ee61b1e91fadcbbf57e28db980bb6096d0874b135ef245eb4265141f10.jpg)

#### All platforms - PlasticX

All platforms - PlasticX: Changes in changeset comments

In the "changeset by changeset" mode for the diff and the code review windows, if a changeset comment started with an empty line you couldn't see it in the changeset list. We fixed it.

Before


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/f44f4fa8be8d84fe6dd10e015214051e9447c8441b838eba4876fd90ad1f5cc6.jpg)

After


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/db4cc91167880ff390ace405920f95d7256026da5ded9f4b8aeed61c3da283f4.jpg)

Also, we improved this panel, now more text will be shown in the changeset names Panel

#### All platforms - GluonX

All platforms - GluonX: Save details panel user preferences

GluonX will remember the following settings about the details panel for the Workspace Explorer view and the Checkin view, giving the user more personalization

* Details Panel visibility

* Details Panel width

* Preview Image height

* Properties Height

* History Height

* Comments height

Also, if no user preference is found, this panel will be visible by default.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/a367ef34fd672b94e5cf8a89539a55cc9845a7346b2ee052a99e9338cbcd9581.jpg)

### Bug

#### All platforms - Web UI

All platforms - Web UI: Fix issue with directories with hashes in them

You are now able to navigate into and view files inside directories that contain hashes in their name.

#### All platforms - Plastic, PlasticX, Gluon

All platforms - Plastic, PlasticX, Gluon: No profiles led to workspace metadata corrupted when co private files

If no profiles were set up, when doing a checkout operation on a private item (add the item) from the Pending Changes view, there was no "owner" of the revision. That caused metadata to become corrupted and, after restarting the GUI, made everything in the workspace appear as private. Now it is fixed.

#### All platforms - GluonX

All platforms - GluonX: Search files dialog unexpected error message

In GluonX, when pressing spacebar key in the search files dialog not in configuration mode, a "unexpected error has occurred" message appeared, we fixed this issue

#### macOS - PlasticX

macOS - PlasticX: Fixed library not found issue when loading extensions

There were some issue tracker extensions that could not be loaded on PlasticX because of an issue with dynamic libraries. The affected extensions were jira, codebeamer and ontime

We fixed this issue and now you can load the extensions in the same way as in the legacy GUI

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Corrected display of recent comments containing underscores

We fixed an issue where comments containing underscore characters were not displayed correctly in the list of recent comments in the Pending Changes and Check-in views of PlasticX and GluonX respectively.

#### All platforms - PlasticX

All platforms - PlasticX: Fixed repeated display of permissions warning in Branch Explorer

Users without the "applyattr" permission would get an error dialog informing them to the fact every time they clicked on any object in the branch explorer.

We moved this intrusive error message to the Attributes panel in the Branch Explorer options side panel.

Here is the text in a dialog:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/19e198463c99614920aaf7a174e2498cb27c0224dda5b614f8a3654c2993f748.png)

And here is the text in the Attributes panel:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/a8d36a7b0f4e51cf703246fd72b0666c78ed68ec32a193adcc2561f753030a3b.png)

#### All platforms - PlasticX

All platforms - PlasticX: Fixed code review plastic links

There was an issue when trying to open code review plastic links with PlasticX, where the GUI just didn't show the code review. This bug was introduced in the last release due to a conflict with another task. The issue is now fixed, and now you can open code review plastic links as before

***

## 11.0.16.7080

> **Note:**
>
> **Public** | 2022-06-15

### New

#### Command-line client

Command-line client: Shelvesets can be created from partial workspaces

Previously, it was not possible to perform a shelve operation in partial workspaces (such as Gluon workspaces). Now we are about to fully support shelves in partial workspaces, and we started with the creation of shelves.

Note that `cm partial shelveset apply` and `cm partial shelveset delete` subcommands are coming up.

Now it is possible to create a partial shelveset of foo.c

```console
c:\wkspaces\partialwk> cm partial shelveset create foo.c

The selected items are about to be shelved. Please wait ...
| Confirming checkin operation 11 bytes/11 bytes [################################] 100 %
Modified c:\wkspaces\partialwk
Added c:\wkspaces\partialwk\foo.c
Created shelve sh:2@wk@localhost:8084 (mount:'/')
```

With the shelveset created, now we could apply it seamlessly to a regular workspace targeting the same repo:

```console
c:\wkspaces\regularwk> cm shelveset apply sh:2

The item /foo.c#sh:2 has been added on source and will be added as result of the merge
Merging c:\wkspaces\regularwk\foo.c
The revision c:\wkspaces\regularwk\foo.c@sh:2 has been loaded
```

The creation subcommand (create | mk) is the default operation, so bear in mind that, if no subcommand is specified, it will try to perform the creation of a new shelveset.

For more examples, you can check the help:

cm partial shelveset --help

cm partial shelveset create --help

#### All platforms - Plastic

All platforms - Plastic: Added support for legacy plastic links

Some time ago we introduced the plastic links feature, which lets you click on links to directly open diffs or code reviews. A plastic link looks like the following:

plastic://codice\@cloud/repos/codice/branches/main/scm24652/diff

Before this new feature, we already had another, more limited implementation of plastic links, that looked like the following:

plastic://showbranch=br:/main/scm24652\@codice\@codice\@cloud

The latter was deprecated, and new versions of Plastic could not handle the old format.

We fixed this issue, and now you can open both legacy and new plastic links seamlessly

#### All platforms - Bamboo plugin

All platforms - Bamboo plugin: New plugin for Bamboo 8 is available!

We released a new plugin for Bamboo 8 that enables you to use Plastic SCM as source control for your build processes. You'll find it in the client installation dir, under plugins/bamboo81plugin.

The former plugin (under plugins/bambooplugin) only supports Bamboo 7.x or older.

#### Windows - Plastic

Windows - Plastic: Open plastic links with last used GUI

When clicking on a plastic link, we were showing a dialog to ask the user whether to use the Legacy Plastic or the new PlasticX GUI to open it. We removed this dialog, and we will automatically open it with the last used GUI.

On macOS and Linux PlasticX is the official version, so plastic links are always opened with PlasticX

### Bug

#### Command-line client

Command-line client: Undo command skips deleted or moved files

Using cm undo over a directory didn't restore files that were not actually there. Now it works as expected.

```console
C:\wk\dir> del file.txt
C:\wk\dir> cm undo .
c:\wk\dir\file.txt unchecked out correctly
```

#### All platforms - Server

All platforms - Server: Fix the update operation with a controlled cloaked.conf file

Working with a controlled cloaked.conf (a cloaked.conf that was checked-in), the update could be wrongly downloading some cloaked content. Usually, it could be downloading the cloaked items affected by the last cloaked rule in the file. Now it's fixed.

### Alpha new

#### macOS, Linux - PlasticX, GluonX

macOS, Linux - PlasticX, GluonX: New Merge tool for binary files

The new cross-platform Binary Merge Tool that we recently added to PlasticX and GluonX on Windows is now available on macOS and Linux.

The Binary Merge Tool allows the user to choose which version of a binary file to keep when there are conflicts during a merge.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/9ea0c49d5b05983ab0289dc1d4b76acb7bea1a2dd738171f643cb20602a44dba.gif)

#### All platforms - PlasticX

All platforms - PlasticX: Use expanders for the Branch Explorer options

Previously, the branch explorer options used splitters to display the configuration. This caused two major usability issues:

* Too much information visible at once.

* Little space to interact with some views.

Now those panels are collapsible, so users can interact better with panels that need more vertical space.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/576c04c16b5724807969dadd15ce37c2e45cf28590051cfc99589c613f51e109.gif)

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: ImageDiff now launched from Diff Window and Merge View

Diffing image files from the Diff Window and the Merge View will now launch the ImageDiff tool.

For example, you can launch the diff from the merge using these menu options:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/7f16a34d4a5c1bc85e4d3987a48356185cf8259e1e58afaf3d2d5d24883661f4.png)

Here is the Image Diff Tool:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/45926600b22886815951a68b1769d76141bb8083b9e7189e34a233f36bc927b7.png)

#### All platforms - PlasticX

All platforms - PlasticX: Enable/disable rules in Branch Explorer

Now the UI allows to enable or disable Filter and Conditional format rules in the Branch Explorer:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/0cebe5a22577e44ac120ee126c74132ad5d0fbba9484751452f0e1274a83fd28.gif)

### Alpha bug

#### All platforms - PlasticX

All platforms - PlasticX: Restored right-click menu options for labels in Branch Explorer

In Branch Explorer, after we recently added the 2 label diff feature, single label right click options stopped  working. We fixed this issue, sorry about that!


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/31240e5e944a39f3ad66a8122fc87095412370d80c87500a3c299f46a3974eb3.jpg)

#### All platforms - PlasticX

All platforms - PlasticX: Error closing Create Account Dialog in the new Home Menu

In Plastic X, when creating an account from the new Home Menu, closing the dialog threw an error, we fixed this issue

#### All platforms - PlasticX

All platforms - PlasticX: Fixed diff scroll "jumps"

Every time the right file in the diff viewer was edited, caused the scroll to jump 1 line up. Now it's fixed.

#### All platforms - PlasticX

All platforms - PlasticX: Fixed diff summary after editing diffs.

After editing diffs, the diff summary (the label that indicates which is the current difference and how many differences there are), was not updated properly. Now it's fixed.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/aea3a3e8e551aeb5f0a42752a42912dd485f1280b381dc416fb3e3373eb7ced7.gif)

#### All platforms - PlasticX

All platforms - PlasticX: Code Reviews changeset column should grow

In Plastic X, when reviewing a code review changeset by changeset, in some cases after resizing the panel the column text didn't grow when expanding

We permanently fixed this issue:

Before:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/6632f35509060c5330e0eb9a512246ae7c4c16546d89e1d7b3e61caa12fb053f.jpg)

After:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/9e4540d7d33966b3700e111441becc10afff88b9da272a014f3db634c24cc92c.jpg)

***

## 11.0.16.7048

> **Note:**
>
> **Public** | 2022-06-09

### New

#### Windows - Plastic

Windows - Plastic: Check out local changes is 300 times faster

Now, checking out local changes is much faster. For example, selecting 135 thousand private and checking them out now it takes less than 4s vs the almost 19 minutes that it took before.

### Bug

#### All clients

All clients: Fixed 'unable to sort' error working with local changes

You could get the error "Unable to sort because the `IComparer.Compare()` method returns inconsistent results" trying to check out, checkin, or undo the pending local changes. It happened due to complex dependencies among the local changes when there were locally moved involved. Now it's fixed.

#### All platforms - Command-line client

All platforms - Command-line client: Paths described in trigger variables can now include whitespaces.

Previously, plastic variables used in triggers such as `PLASTIC_BIN_PATH`, `WKSPACE_PATH` and `GLOBAL_CONFIG_PATH` were not resolving paths with white spaces. That led to wrong command formats when executing. Now, these paths are being wrapped inside double quotes when needed.

You can have the following scenario:

Have the directory where the Plastic SCM command line client is installed:

```text
C:\Program Files\PlasticSCM\client
```

And inside it, you are planning to store your triggers in a subfolder, something like:

```text
C:\Program Files\PlasticSCM\client\script\after update\script1.pl
```

So, you could declare a trigger using the following scheme (in Windows cmd shell, for instance):

```text
cm trigger make after-update myTrigger """@PLASTIC_BIN_PATH\scripts\after update\script1.pl""" --server=localhost:8084
```

And it will solve the white space in `PLASTIC_BIN_PATH` to `C:\Program Files\PlasticSCM\client` when executing the trigger.

Bear in mind that, as the path already has a whitespace ("after update" in the example above), you should add escaped quotes to it to specify the executable because we also support arguments. No extra quotes will be added in this case. Here we were considering cmd shell, so quotes are escaped with an extra double quote.

You can also use commands with arguments and both command paths and arguments will properly resolve white spaces:

In case you have a workspace such as `C:\my wkspace` you could create a trigger like the following:

```text
cm trigger mk after-update callPython "python @WKSPACE_PATH\script.py @WKSPACE_PATH" --server=localhost:8084
```

In this case, the whitespaces are going to be inserted in the plastic variable. This trigger will execute python, calling the file named `script.py` located in your workspace and passing to it an argument which is also resolved to the same path, something like executing:

```text
python "C:\my wkspace\script.py" "C:\my wkspace"
```

Find below examples of the same two commands to create triggers but in three different shells:

1- Windows CMD:

```text
cm trigger make before-update myTrigger """@PLASTIC_BIN_PATH\scripts\before update\script1.pl"" @WKSPACE_PATH\src\readme.txt" --server=localhost:8084
```

```text
cm trigger make after-update myTrigger """@PLASTIC_BIN_PATH\scripts\after update\script2.pl""" --server=localhost:8084
```

2- Windows PowerShell

```text
cm trigger make before-update myTrigger "`"@PLASTIC_BIN_PATH\scripts\before update\script1.pl`" @WKSPACE_PATH\src\readme.txt" --server=localhost:8084
```

```text
cm trigger make after-update myTrigger "`"@PLASTIC_BIN_PATH\scripts\after update\script2.pl`"" --server=localhost:8084
```

3- Linux/MacOS bash:

```text
cm trigger make before-update myTrigger ""@PLASTIC_BIN_PATH/scripts/before update/script1.pl" @WKSPACE_PATH/src/readme.txt" --server=localhost:8084
```

```text
cm trigger make after-update myTrigger ""@PLASTIC_BIN_PATH/scripts/after update/script2.pl"" --server=localhost:8084
```

#### All platforms - Server

All platforms - Server: Fixed slow connection issues

We fixed a bug that caused the server to close connections over SSL if the client did not start the second method call in under 10 seconds from the connection establishment.

This bug was because of a wrong tracking of the connection status from server side and could cause killing long-running operations (such as big check-ins) over slow networks with the error message "An existing connection was forcibly closed by the remote host".

#### Command-line client

Command-line client: Fixed null error undoing moved files

The "cm unco" could fail when there are pending moved files to undo. It could fail when the source and the destination directories are different directories, but both are under the same directory. Now it's fixed.

### Alpha new

#### All platforms - PlasticX

All platforms - PlasticX: New cross-platfrom mergetool

Resolving conflicts in text files during merges will now launch a new cross-platform merge tool.

When the merge tool window is opened, it tells you how many conflicts require user intervention. For each conflict, you can choose to take contribution from the remote version, your local version, or the base of the merge, by clicking the checkbox by each change.

Step back and forth through the remaining unresolved conflicts using the arrows at the top of the screen. You can also step through all conflicts - unresolved, ones you've already resolved, and ones which were resolved automatically.

The result of the merge is shown in the bottom panel. Once all conflicts are resolved, click Save and Exit to return to the merge.

Here is an example conflict resolution.

Before the resolution:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/e72bfed614486e2691c18382ae6761e8407c285521a6b43cbccf3aa2c6525aa4.png)

And after the resolution. I chose to keep the local changes:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/7c1f67cb95afd28efde572aac92feec1b0c1912eb3f1f8fa4a6ab17d7d54841f.png)

#### Windows - PlasticX

Windows - PlasticX: New Merge tool for binary files.

We ported our legacy binary merge tool (only available in Windows GUI) to PlasticX.

The binary merge tool allows the user to choose a version when all the versions in a merge, are changed. When resolving the merge, the chosen version will be the resulting file after the merge.

When the content of the merged file can be previewed (any [PlasticX supported image type](https://www.plasticscm.com/download/releasenotes/11.0.16.6718#11.0.16.6718-alphanew-3)), the preview is displayed. Otherwise, the OS file icon is displayed.

The tool allows to "Open" or "Open with..." each version to allow the user to compare them. Also, some properties, such as file size or date modified, are displayed to help the user to choose a version.

This is an example of merging a Word document:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/63c3fb416f477e5e9cba64b424b9a174d08c8ae42b6794b8fc51ff5378cb4b7a.gif)

And this is an example of merging a png image:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/9ea0c49d5b05983ab0289dc1d4b76acb7bea1a2dd738171f643cb20602a44dba.gif)

#### All platforms - PlasticX

All platforms - PlasticX: Repository Empty State

On home view, when a repository contains no files or directories, an "empty state" was added to what would otherwise be a blank panel.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/6a7dd42ca263112e9d268a11843cce82fe93eee3de4e5c875469c754cf3d4483.png)

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Added undelete and undelete to the specified path

Added the 'Undelete revision' and 'Undelete revision to specified path...' options to the context menu for the diff window. It can be used to restore a single or multiple deleted items in PlasticX and GluonX.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/84dd337941d285ba0ba85f89b2e8aa261c66b54865be2aebbec84841abcf5680.jpg)

#### All platforms - Plastic

All platforms - Plastic: Added explanatory text to the welcome window

When you open Plastic for the first time, you are asked to choose the GUI to work with. We added an explanatory text at the bottom of this window, which lets you know that you can change the GUI flavor at any time:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/bee23712ed8a491db8b1729d89ec0c01991a2495f5682f74e538dc4651924cc1.png)

***

## 11.0.16.7026

> **Note:**
>
> **Public** | 2022-06-02

### Bug

#### All platforms - Eclipse

All platforms - Eclipse: Could not merge with writable xlinks

Eclipse plugin (and other Plastic SCM java plugins with merge capability) were unable to perform a merge from a branch when writable xlinks are involved in the merge operation. A `Unable to cast object of type ...` error was thrown instead. Now it is fixed.

#### Command-line client

Command-line client: Cannot check out through symlinks

When symlinks contain '.' and '..' elements in their target paths, some commands failed to walk through them:

```console
$ cm co links/linkedfile.txt
```

Note the path wrongly contains a '..' element:

```console
The element '/wk/links/../content/file.tx^' is either a private file or it is already checked out in the current workspace.
```

Now they work as expected.

#### Windows - Plastic/Gluon

Windows - Plastic/Gluon: Fixed slow open files from dynamic workspaces.

Some applications (like notepad) start much slower when they are started specifying a working directory that is a network path (UNC path). To work around this, Plastic & Gluon now use the local path (instead of the network path) before opening a file.

This problem was only reproduced when the dynamic workspace was mounted using a network path.

#### Windows - Plastic/Gluon

Windows - Plastic/Gluon: Fixed "Open in Explorer" menu option for dynamic workspaces.

This "Open in Explorer" menu option didn't work for dynamic workspace mounted with a network path. Now, it works as expected opening the right directory in a new Explorer window.

### Alpha new

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Display cache status for Dynamic Workspaces.

We continue with improvements to better support [Dynamic Workspaces](https://blog.plasticscm.com/2021/07/dynamic-workspaces-alpha-for-windows.html) in the GUI. This time we display the cache status of each file in the Status column.

* The "cloud" icon means the file content never was downloaded to the disk, helping to save disk space.

* The "tick" icon means the file was opened or accessed at least once, so it was already downloaded to the shared cache. This also helps to save disk space since the revision contents are shared across the different workspaces. So if have more than one Dynamic Workspace, the revision contents are re-used across them.

Some demo:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/616577ea89ff3ac29cc03809e6260d6a565c036a2e04b06dbdd6dcf72510212b.gif)

#### All platforms - PlasticX

All platforms - PlasticX: Remove user profile

A new option has been included into the home view accounts combo box. It allows for removing the selected user profile from the list.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/0a95219fa905a6488e7ac4891175ee902a5006cac92e4072115d4cdc455c2c02.png)

#### All platforms - PlasticX

All platforms - PlasticX: Better trackpad support in the differences viewer.

Now, when using the laptop trackpad to scroll the differences view, the movement is smoother. Check this demo:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/56076e8721bca2c5918c374e66bf05dfcf3c27e2f0fd3067d207345ea9c055b6.gif)

#### All platforms - PlasticX

All platforms - PlasticX: Added directory conflict overlay icon

Added two new directory conflict overlay icons when a directory conflict is detected in PlasticX

* When a directory conflict is unsolved

* When a directory conflict is solved


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/01cd4d7fa683dee94ee1ae5cdb1ba9303d2ebdbcb594981d244f7e6131a6e1d6.jpg)

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Unified credentials dialog

When trying to perform an operation on a server without being authenticated, we were asking the user for credentials by using a custom dialog, which was different depending on the authentication method.

We modified this behavior, and now you will see the same dialog that is shown when creating a new account:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/d68d58d309cde85d977a6da928d817188bcfbc3ed6393c744f1a623eef3281c5.png)


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/3a7d2e241da176994dec11fd7c0b45088ba36576998796f8efbbf5eef73d2207.png)

#### All platforms - Plastic, Gluon

All platforms - Plastic, Gluon: New browse repository dialog

When adding a new path permission on PlasticX, you had to manually type the path of the object you wanted to apply the permissions on. Now, we added a new dialog that shows you the repository tree on the main branch, so you can just select the item on the tree without having to type the full path:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/2e639065d8fdf8aea177abc5af61d1c8e2d20b7e48742230e90b34b63e526333.png)


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/f8ca8c44e9ea22e093400c2786b22182b64837da40c335408a52bc63676fad4c.png)

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Spacebar to check/uncheck items in Update Reports

Now is possible to use spacebar key to check/uncheck items in Update Reports dialogs in PlasticX and GluonX.

This feature will also now affect .meta files, selecting the associated .meta file too.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/81670e154b4ab6773168407e51cdf5da555fb5c7a70f816057f4feb3177a1036.jpg)

***

## 11.0.16.6994

> **Note:**
>
> **Public** | 2022-05-26

### New

#### Linux - Server

Linux - Server: Enable setting WebAdmin port under 1024

The server can now be configured to start the WebAdmin in ports below 1024.

To do that, edit the `/opt/plasticscm5/server/server.conf` and change the default values (ports 7178 and 7179) for the new ones at your convenience on the following configuration keys:

```text
WebAdminToolPort
```

```text
WebAdminToolSslPort
```

### Alpha new

#### All platforms - PlasticX

All platforms - PlasticX: Add diff selection to text editor

New option to check differences from selected lines in text editor has been added:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/466896c9310c35dc7afdaadf97aa2cc1b76c08d68aaa6cb16aa52806f36c27e7.png)

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Open files on Enter key pressed

The Enter key pressed will open the selected files from Workspace explorer tree.

#### All platforms - PlasticX

All platforms - PlasticX: New icon for dynamic workspaces.

We designed a new icon for [Dynamic Workspaces](https://blog.plasticscm.com/2021/07/dynamic-workspaces-alpha-for-windows.html). So now, those workspaces that are dynamic use a new icon so the user can be differentiated from the standard workspaces.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/0d42eb932e51b73a943fb4764f933a093db8dfe9c9be7cbbcabe34578815c359.png)

NOTE: Dynamic Workspaces are available only on Windows platforms for now.

#### All platforms - PlasticX

All platforms - PlasticX: Add help link for dynamic workspaces.

When creating a workspace, we added a link label to our blog explaining what [Dynamic Workspaces](https://blog.plasticscm.com/2021/07/dynamic-workspaces-alpha-for-windows.html) are, and what are they for.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/d7c81a448da3254a446f972f7969602bb2d54ebf3e1cf623b555de0ce979f5d4.png)

#### All platforms - Plastic, Gluon

All platforms - Plastic, Gluon: Improved sign in to cloud server on on-premises mode

When you selected the on-premises mode for the sign in, and entered a cloud server, we were showing a dialog with the sign-in options available for that server.

We integrated this view inside the same dialog that is used to create the account, so the process is cleaner.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/514815f5365a756a0b54939e9b1fe093fc87e7f52bfbb2f45d2817db971bf781.png)

### Alpha bug

#### All platforms - PlasticX

All platforms - PlasticX: Workspace explorer symlinks

A few issues have been fixes related to symlinks on the workspace explorer:

* Checkout, undo checkout, lock and checkout now support symlinks

* Symlinks are now represented by the correct native icon

#### All platforms - PlasticX

All platforms - PlasticX: Code review didn't navigate to the comment correctly

Under some circumstances, the code review didn't navigate to the correct file and line when you double-click a comment. In addition, sometimes, a wrong message appeared to notify you about the file was deleted when it was not the case. Now both bugs are fixed.

***

## 11.0.16.6979

> **Note:**
>
> **Public** | 2022-05-19

### New

#### Windows - Plastic

Windows - Plastic: file plastic links now open in GluonX

Opening a file plastic link will now launch GluonX rather than Gluon.

#### All platforms - Cloud server

All platforms - Cloud server: Now the Plastic SCM Cloud Server won't abort write operations if there is a backup in progress.

There is a small chance that the Cloud server can start backing up one of your repositories while you are working on it. This chance is small because the Cloud server analyzes repository usage tendencies to predict the best time to backup data without interrupting your work. However, no prediction is perfect. If you encountered that unfortunate scenario you are familiar with this error message:

```text
The backup of the "repository@organization" database is in progress. Only read operations are allowed on it.
```

This is now fixed. If you try to perform a write operation on a repository that is undergoing a backup, your operation will wait a grace period for the backup to finish before throwing an error back to you.

#### All platforms - GluonX

All platforms - GluonX: New GUI announcement

We are happy to announce that our new, cross-platform, GUI for artists, "GluonX", is now the default on all platforms.

GluonX has all the functionality of the legacy Gluon applications across all platforms wrapped in a modern new interface. It also includes support for changelists in the Check-in view, and easy switching between light and dark modes.

Here's how it looks in dark mode:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/0de21ac457c2b92c861402a8a61014d7486db641ea520027598bb308a9b9c2a2.png)

Note, you can switch back to the legacy GUI at any time by selecting the option from the menu:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/aaa3bec8da401fb5801a955bcc6db8f3e12ad0a68d7f92692c09e0ceebf62132.png)

#### IDEA Plugin

IDEA Plugin: IntelliJ IDEA 2022 support

We've updated our plugin and it supports IntelliJ IDEA 2022.x now!

### Bug

#### All platforms - Partial update fails when a file…

All platforms - Partial update fails when a file was replaced

If a file was moved somewhere else and a second file with the same path was then added, going back and trying to do a partial update over a third file would fail to apply all changes and an error message was shown.

```console
cm partial update file.txt
Calculating...
The new item cannot be loaded in the workspace. Probably, the path is already used. Please unload the item (from the configuration view) and retry the operation.
```

Now it is fixed.

#### Windows - Jenkins

Windows - Jenkins: The command line client used by the plugin couldn't run.

The Jenkins plugin automatically downloads a Plastic SCM command line client bundle to perform VCS operations. But the application ("cm.exe") didn't start properly due to a missing .dll file. Fixed.

### Alpha new

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: fixes and added new keyboard shortcuts

PlasticX:

* Pending Changes View: added missing keyboard shortcut for "Checkout"

* History Panel: Added new keyboard shortcuts in HistoryPanel, for Open and Diff with previous revision

* Browse Repository: Added new keyboard shortcuts in "Browse repository in this label" and "Browse repository in this changeset", for "Open", "Diff with previous revision" and "View History"


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/60977151b7a69b14939c489889067dac08395f009ecbde22276ac724dcff2e22.jpg)

GluonX:

* Workspace Explorer View: fixed existing keyboard shortcuts not working, added events

* Workspace Explorer View: added missing keyboard shortcut for "Add to source control"

* Workspace Explorer View: added missing keyboard shortcut for "Add directory tree to source control"

* Workspace Explorer View: added missing keyboard shortcut for "Undo checkout"

* Workspace Explorer View: fixed open in explorer name ("Open in explorer" in Windows/Linux,"Reveal in Finder" in Mac)

* Workspace Explorer View: added missing keyboard shortcut for "Open in explorer"

* Checkin View: fixed open in explorer name ("Open in explorer" in Windows/Linux, "Reveal in Finder" in Mac)

* Checkin View: added missing keyboard shortcut for "Open in explorer"

* Checkin View: added missing keyboard shortcut for "Checkout"

* History Panel: Added new keyboard shortcuts in HistoryPanel, for Open and Diff with previous revision


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/8170c6b581e0a869c85eca9bf4a9410b0e607da7dc1acc97e153660bfcd033dc.jpg)


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/acba16fd14390a88d371c6bed1c17a382cbd013704a0894ea6f4e40f4b330635.jpg)

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Spacebar to check/uncheck items

Check/Uncheck all selected nodes from tree views with checkable items on spacebar key down.

#### Windows - PlasticX

Windows - PlasticX: Dynamic Workspaces configuration

A new tab option has been added for "Dynamic workspaces" in the Preferences window. This new view contains the status of the plasticfs process (running/not running) and allows user to install this feature if it's not running. Turning on the plasticfs, the dynamic workspaces functionality is automatically enabled and ready to be used.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/8d1050fbd34c127e951a63b8a3e921665a971b978855cdfe5fc8a08cefe94638.gif)

Link to the video: [https://imgur.com/cnSpjPl](https://imgur.com/cnSpjPl)

#### All platforms - PlasticX

All platforms - PlasticX: file plastic links now open in GluonX

Opening a file plastic link will now launch GluonX rather than Gluon.

#### All platforms - Plastic, Gluon

All platforms - Plastic, Gluon: Improved enterprise edition onboarding

We unified the onboardings in the cloud and enterprise edition. Now both use the same view, and you can connect to an on-premises server or to a cloud server from both editions. This is how it looks:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/a52a8f114be18df22cd5d18ec2c90e881c184375d7b2601f14df86cd3c33ce7c.png)


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/7521b948be2fbd8669dc34518515c8bd3c977434a4f26d45b62c54b8c7378685.png)

#### All platforms - PlasticX

All platforms - PlasticX: Compact the UI.

Reduce the overall margins/paddings to make the UI a little bit more compact, so more content is visible in the display. We compacted the following UI elements.

* PlasticX/GluonX: Compact the TreeDataGrid node height.

* PlasticX/GluonX: Compact the Switch Workspace button paddings.

* PlasticX/GluonX: Compact the PlasticX Topbar height.

* PlasticX/GluonX: Compact the Home view toolbar panels.

* PlasticX: Compact the left SideBar item height.

* GluonX: Compact the Tab bar.

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: handle .meta files

Selecting an asset for check-in in the Pending Changes view in PlasticX and the Check-in view in GluonX will now automatically selected the associated .meta file too. This also applies to the Incoming changes view and the Workspace Configuration view of GluonX.

#### Windows - Command-line client

Windows - Command-line client: Symlinks are now supported

We added support for symlinks on Windows! The long awaited feature is now here for command line only (GUI fixes coming soon).

\== WHAT IS NEW ==

Symlinks created previously on Linux and macOS were replaced on Windows by placeholder text files containing the linked path.

Now, the Plastic command line supports Windows symlinks as well.

\== REQUIREMENTS ==

To create symlinks, Windows 10 build 14972 or newer is required. You also need to enable Developer Mode ([https://docs.microsoft.com/en-us/windows/apps/get-started/enable-your-device-for-development](https://docs.microsoft.com/en-us/windows/apps/get-started/enable-your-device-for-development)).

\== HOW TO ENABLE THE FEATURE ==

Symlink support will be enabled by default in forthcoming versions. For now, you can add the following key to your client.conf:

```text
<EnableSymlinkSupportOnWindows>yes</EnableSymlinkSupportOnWindows>
```

Note 1: GUI support is still in progress. By enabling the feature and using symlinks you might experience glitches in the GUI.

Note 2: PlasticFS still does not support symlinks and this feature might interfere with its proper behavior. You might need to mount your workspace right under a volume specifier. For instance:

```console
cm wk MY_WORKSPACE D:
```

Note 3: If you enable this feature, symlinks placeholders will eventually be promoted as private files. If you still have any in your workspace, you can remove them and let Plastic to recreate them as actual symlinks.

Note 4: If you disable this feature, dangling symlinks in your workspace might deceive the Plastic client. Remember to erase them immediately after.

\== HOW TO CREATE SYMLINKS ON WINDOWS ==

You can use the same Plastic commands and options you would use on Linux or macOS:

```text
C:\wkspaces\sokoban> mklink /D Scripts Assets\Scripts
C:\wkspaces\sokoban> cm add Scripts
The selected items are about to be added. Please wait ...
Item c:\wkspaces\sokoban\Scripts was correctly added
C:\wkspaces\sokoban> cm ci --symlink Scripts
The selected items are about to be checked in. Please wait ...
- Checkin finished 26 bytes/26 bytes [################################] 100 %
C:\wkspaces\sokoban> cm co --symlink Scripts
The selected items are about to be checked out. Please wait ...
Item c:\wkspaces\sokoban\Scripts was correctly checked out
C:\wkspaces\sokoban> cm undo --symlink Scripts
c:\wkspaces\sokoban\Scripts unchecked out correctly
```

### Alpha bug

#### All platforms - PlasticX

All platforms - PlasticX: fixes in GUI help

Fixed broken links in GUI help

* [Link to ignore/hidden help](https://plasticscm.com/download/help/ignored-hidden-etc.html) was broken, replaced with [an updated one](https://plasticscm.com/download/help/ignored-hidden-etc).

* [Link to recursive merge help](https://plasticscm.com/help/recursivemerge) was broken, replaced with [an updated one](https://plasticscm.com/download/help/recursivemerge).

Fixed "You can also customize the query by clicking Advanced" links in Changesets View and Labels View help, the links now works correctly

#### All platforms - PlasticX

All platforms - PlasticX: Fixed an "unexpected error" in the diff view.

During the view initialization, sometimes clicking the diff view raised an "An unexpected error has occurred". Now it's fixed.

#### All platforms - Gluon

All platforms - Gluon: Corrected text to switch to Plastic

In the top right menu of Gluon there's an option to switch to the Plastic SCM GUI. When opening the menu from the home view, the text of this option said "Switch to Gluon", which was incorrect. We fixed this issue:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/812b97df5e5e719eb3034208aca8f5a58c1f40860872a58ec4d9eee26864a3fd.png)

***

## 11.0.16.6949

> **Note:**
>
> **Public** | 2022-05-12

### New

#### Windows - Visual Studio 2022 plugin

Windows - Visual Studio 2022 plugin: Performance improvements!

Improves startup by asynchronously performing the initialization process.

#### All platforms

All platforms

Command-line client outputs its version as log's first line

Now the cm will store the cm version at the top of the log

```text
2022-04-29 16:26:57,891 1 (null) (null) (null)  INFO  cm - cm version: 11.0.16.6891
2022-04-29 16:26:57,919 1 (null) (null) (null)  INFO  cm - STARTING CLIENT
...
```

#### Server - Merge and Incoming Changes are much fast…

Server - Merge and Incoming Changes are much faster with pending added

The calculation of the merge or the incoming changes was slow when the workspace had several pending added items in the same directory.

In the reported case, a workspace with 384000 added files in the same directory took over 3 hours to calculate the incoming changes. Now, the same scenario takes less than 2 seconds to complete it. Now, it's 5000 times faster.

#### Linux - Installers

Linux - Installers: Updated GPG keys to install plasticscm packages

We updated the GPG keys of plasticscm.com for Linux packages downloading, so you can safely install Plastic SCM in your Linux distro.

Depending on the distro you are using, a reminder of new GPG key found may appear.

### Bug

#### All clients

All clients: Global config not working with cloaked rules.

The global configuration was not properly read/updated if there was a cloaked.conf file in the users configuration folder. This file is automatically created from the GUIs when adding a file/folder to the cloaked list with the "Apply rules to all my workspaces" option checked.

The global configuration repository is internally downloaded by using the fast-update operation which doesn't work if there are cloaked rules defined. However, it doesn't make sense to take into account the cloaked rules for global configuration workspaces, so they are just ignored.

#### Windows - Visual Studio 2022 plugin

Windows - Visual Studio 2022 plugin: Multiple bugs fixed

Fixes toolbar and menu controls that now are enabled/disabled correctly depending on version control found or not.

Fixes workspace not being initialized in some cases by detecting if the solution was already opened before the plugin is initialized and acting accordingly

Fixes Visual Studio getting frozen by removing views restoration in the situation where the solution is already opened (e.g. double-clicking on the .sln file to open a solution)

#### Wildcard expansion not working for paths with whi…

Wildcard expansion not working for paths with white spaces

Some commands failed when using wildcards involving paths with white spaces:

```console
cm add -r *
cm ci "A set\*" --all
The selected items are about to be checked in. Please wait ...
Error: The item /A set/* is not changed in current workspace
```

Now these commands work as expected.

### Alpha new

#### All platforms - PlasticX

All platforms - PlasticX: New onboarding experience!


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/f7fcc617966a0b7fd9695d56f32567654ead62e21c87474ea81681e10046422e.gif)

Link to the video: [https://i.imgur.com/mcVJvWk.mp4](https://i.imgur.com/mcVJvWk.mp4)

This is what comes with the new "home" section:

* Now it's much easier to join to an existing organization or create a new one.

* A single place to manage all the accounts, cloud organizations, repositories and workspaces.

* One single way to do the entire onboarding.

* Always available to return to it, not just like the old onboarding that was only present at the beginning and hard to find after that.

We encourage you to try the new "home" view, and send us your feedback (via [https://forum.plasticscm.com/](https://forum.plasticscm.com/)). Remember that if you want to try it the Windows Platform, you need to use the new Plastic X GUI.

#### All platforms - Plastic, PlasticX, Gluon, GluonX

All platforms - Plastic, PlasticX, Gluon, GluonX: Handle recent comments per workspace

The applications now save and display the recent comments per workspace.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/55181a7109fad747bcb205b275bf250fa2c5b75eb6f1959a0447f97fe7b2381c.jpg)

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: ComboBox on focus border color

The comboboxes border color will change when get the focus.

#### All platforms - PlasticX

All platforms - PlasticX: Diff between labels

It has been added 2 new diff options to labels context menus, "Diff selected labels" and "Diff with another label", these options can be found in context menus of Labels view and Branch explorer.

* "Diff selected labels" will open the diff window with the diff data between labels

* "Diff with another label" will open a new explorer dialog with the list of the existing labels. Once one label is selected in this dialog the diff between the selected labels could be requested.

It has been also added the color effect on labels multiselection in Branch explorer.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/fb090e458d06b0feca7dfd790173bf9136592b80db32af7b0f5199024b45495d.png)

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: improved scroll when deleting an added item

We improved scroll when deleting an added item or a changelist item in pending changes view/ checkin view, now the program should scroll and focus better the nearest item

#### All platforms - GluonX

All platforms - GluonX: implemented native menu on Mac

We implemented the macOS native menu for GluonX.

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: enabled menu on Switcher window on Mac

We enabled the macOS native menu on the Switcher window.

### Alpha bug

#### All platforms - GluonX

All platforms - GluonX: Fix null exception

If you tried to create a file or a directory in a private directory, a null exception appears

We fixed this issue.

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Fix small bug in changelists

If you tried to move a changelist to another changelist with similar name, the changelist name didn't appear, we fixed this issue.

* Before:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/3da75b18279969e32c3c87630e59499d34996f210e6f95b09d9d81710991fe62.jpg)

* After:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/8f6e9ab32668df3a826732bdd34c457905fbf4dafdf2281332a4009ada51a837.jpg)

#### All platforms - GluonX

All platforms - GluonX: Fix convert to partial workspace

Sometimes, if you tried to convert a Plastic workspace to a Gluon workspace, the update button didn't work.

We fixed this issue.

#### All platforms - PlasticX

All platforms - PlasticX: fixed issue where branch not shown for xlinks

The branch name was not being displayed in the Workspace Explorer for xlinks in the root of workspace. We corrected the issue.

#### All platforms - PlasticX

All platforms - PlasticX: Code Reviews changeset column should grow

In Plastic X, when reviewing a code review changeset by changeset, the column text didn't grow when expanding.

We fixed this issue:

Before:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/6632f35509060c5330e0eb9a512246ae7c4c16546d89e1d7b3e61caa12fb053f.jpg)

After:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/9e4540d7d33966b3700e111441becc10afff88b9da272a014f3db634c24cc92c.jpg)

#### macOS - GluonX

macOS - GluonX: "Try new GUI" failed in Cloud Edition

When clicking the "Try new GUI" button on Gluon, and opening the new GluonX, we were asking the user for credentials again. This only happened in cloud edition.

Now this issue is fixed. Switching to the new GUI will open the workspace that was previously open on Gluon without any intermediate steps.

***

## 11.0.16.6907

> **Note:**
>
> **Public** | 2022-05-05

### Bug

#### All platforms - Plastic

All platforms - Plastic: Fix error when running git sync with UTF-32 files

When performing a git sync with UTF-32 files, sometimes the error "Encoding error Unicode (UTF-32)" was encountered.  The git sync should now be able to complete without issue.

### Alpha new

#### All platforms - PlasticX,GluonX

All platforms - PlasticX,GluonX: Save expanded and selected items

The application will now remember the following workspace configurations

PlasticX Items View:

* Expanded items

* Selected items

* Horizontal and Vertical scroll position

GluonX Workspace Explorer:

* Expanded items

* Selected items

* Horizontal and Vertical scroll position

* Hide private items

* Exclude privates from directory size

***

## 11.0.16.6898

> **Note:**
>
> **Public** | 2022-04-28

### New

#### Command-line client

Command-line client: New environment variable to track the merge info during an 'after-clientcheckin' trigger

The `after-clientcheckin` trigger will now fill a new environment variable named `PLASTIC_MERGE_LINKS` with info about the merge links (if any) introduced in the checkin operation (i.e. checking in a merge from another branch).

The value of the `PLASTIC_MERGE_LINKS` environment variable would be like this format (just one merge link):

```console
mergetype:<TYPE_OF_MERGE_LINK>,source:<CHANGESET_NUMBER>@rep:<REP_NAME>@repserver:<REP_SERVER>
```

And if there are several merge links in the checkin operation, they will be separated by semicolon ';' char:

```console
mergetype:<TYPE_LINK#1>,source:<CHANGESET_NUMBER#1>@rep:<REP_NAME#1>@repserver:<REP_SERVER#1>;mergetype:<TYPE_LINK#2>,source:<CHANGESET_NUMBER#2>@rep:<REP_NAME#2>@repserver:<REP_SERVER#2>
```

Example:

```console
PLASTIC_MERGE_LINKS=mergetype:merge,source:264@rep:tools_repo@repserver:rainbow:8087
```

Please refer-to the [client checkin triggers documentation site](https://www.plasticscm.com/documentation/triggers/plastic-scm-version-control-triggers-guide#Clientcheckin) for further info.

#### Server

Server: New environment variable to track the merge info during an 'after-checkin' trigger

The `after-checkin` trigger will now fill a new environment variable named `PLASTIC_MERGE_LINKS` with info about the merge links (if any) introduced in the checkin operation (i.e. checking in a merge from another branch).

The value of the `PLASTIC_MERGE_LINKS` environment variable would be like this format (just one merge link):

```console
mergetype:<TYPE_OF_MERGE_LINK>,source:<CHANGESET_NUMBER>@rep:<REP_NAME>@repserver:<REP_SERVER>
```

And if there are several merge links in the checkin operation, they will be separated by semicolon ';' char:

```console
mergetype:<TYPE_LINK#1>,source:<CHANGESET_NUMBER#1>@rep:<REP_NAME#1>@repserver:<REP_SERVER#1>;mergetype:<TYPE_LINK#2>,source:<CHANGESET_NUMBER#2>@rep:<REP_NAME#2>@repserver:<REP_SERVER#2>
```

Example:

```console
PLASTIC_MERGE_LINKS=mergetype:merge,source:3534@rep:assets_repo@repserver:rainbow:8087
```

Please refer-to the [server checkin triggers documentation site](https://www.plasticscm.com/documentation/triggers/plastic-scm-version-control-triggers-guide#Checkin) for further info.

#### All platforms - Command-line client

All platforms - Command-line client: New 'cm configure' command replaces 'clconfigureclient' tool.

The `clconfigureclient` tool was a mono/netframework application, and it had troubles configuring a client with a server using ssl on linux and macOS. This was caused due to unmatched security protocol for the ssl connection between the `clconfigureclient` process and the plastic server.

To fix this, we have removed the `clconfigureclient` application, and created a subcommand for the regular command-line-client of Plastic SCM (that runs on netcore, and thus accepts enhanced security protocol, enabling a correct ssl handshake with the plastic server).

The new command is `cm configure` command, and does the same as `clconfigureclient` application.

Issue `cm help configure` to show the command help for further info.

#### All platforms - Gluon

All platforms - Gluon: Try the new Gluon GUI!

You are cordially invited to try out the new Gluon GUI, codenamed GluonX. GluonX has all the functionality of Gluon across all platforms, and additionally includes support for changelists in the Checkin view.

To make it as easy as possible, we have added a button to the existing Gluon GUIs which will launch the new GUI. Note, you can switch back at any time using the "Switch to legacy GUI" option in the menu at the top right of the new GUI.

Switch to new GUI on Windows:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/db77fe6e967e6efb8959bf73fa0336c5b5bc128e0dd394b8d3d0d0bd321fe522.png)

Switch to new GUI on Mac:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/92bbf037623ecdd0115d365c555340c5bec69228c259ce5e25f325c277728037.png)

Switch to new GUI on Linux:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/067620c305056b39f4b92604784c7ce470c6261cbfd8e0428972ab3dc8fdb793.png)

When GluonX is launched you will be presented with this welcome screen:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/4bcacbdf41ea13e33d88d12af88a512f2574853e7a357717c9c2cbb61b635644.png)

Switch back to original GUI:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/7106a0f101ccaee929e6251aea934ac73530399eab91344f36c1c835159424fa.png)

Please give the new Gluon GUI a try and share your thoughts with us.

### Bug

#### Command-line client

Command-line client: Creating a branch no longer allows empty branch names

Previously when creating a child branch it was possible to create one with an empty name. It now will return an error message instead.

#### All clients

All clients: The fast-update operation failed with after-update triggers.

The fast-update operation failed with an "Object reference not set" exception when running the after-update trigger if the workspace was already up-to-date (it means, if it already pointed to the branch head).

This operation is internally used to update changes from the global configuration repository (plastic-global-config), so it also made the application of the global configuration in the workspace fail.

#### All clients

All clients: Some trigger environment variables were not properly set for fast-update.

The PLASTIC\_INITIAL\_CHANGESET and PLASTIC\_FINAL\_CHANGESET environment variables were not set for the fast-update operation when running before/after-update triggers. Now it is fixed.

### Alpha new

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Loading spinner in Diff window

When the diff window is opened a progress spinner will be displayed while the diff data is loading.

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Save user columns preferences

PlasticX will remember user columns width, sort column, and sort column order preferences every time we open the program, giving the user more personalization options

Also, we decreased default column size in columns "status", "created by" and "repository" in Items View

#### All platforms - PlasticX

All platforms - PlasticX: Permission dialog is now resizable

We added the option to resize all permissions dialogs in PlasticX


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/e2ad18007f1da1e2246312418978ea7169d80de140ddc5d7b9a937b52ad6febc.jpg)

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: version in client logs.

"plasticx.relevant.log.txt" and "plasticx.debug.log.txt" log files will include program version as the first log trace (INFO).

#### Windows - PlasticX

Windows - PlasticX: Added SemanticMerge to solve conflicts for supported languages

We added SemanticMerge tool to be launched automatically to solve conflicts during the merge operation for csharp, vb.net, and java languages.

Now you have the semantic power by default in the merge without having to configure it.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/fd4745ee540861d73f68b034cc5091ab4bf5a9d5aab900b93ccea145022f4820.png)

#### All platforms - GluonX

All platforms - GluonX: added Plastic Link button!

You can now copy Plastic Links into the clipboard and share file links with your colleagues.

A Plastic Link is like a URL that points to a file in a Plastic repository. You can send links to controlled documents to other people, and when they click on the link, the document will be downloaded into their workspace.

Click the Copy button in the Details panel to copy a file link into your clipboard:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/324855fe9501ff21b3627c4c1fa49c2597b9f03a0766a0500d405c0ba0d58dda.png)

#### All platforms - PlasticX

All platforms - PlasticX: Diff changeset by changeset

Added a new mode for diff branches, the diff changeset by changeset mode which allows to get differences for every changeset from a branch.

Both diff modes "Diff entire branch" and "Diff changeset by changeset" will be available in the Diff window and could be switched between each other, the "Diff entire branch" mode will be displayed by default.

The "Diff entire branch" mode will display:

* The branch diff changed files.

* The selected file diff panel.

The "Diff changeset by changeset" mode will display:

* The list of changesets panel for this branch.

* The selected changeset comments panel.

* The diff changed files for the selected changeset.

* The selected file diff panel.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/f413e97b61e998673c213cb977e763aa6f83123b8225b4d9a53c9f1e14158155.png)

### Alpha bug

#### All platforms - PlasticX

All platforms - PlasticX: fixed Japanese text truncation on Sync view buttons

The fixed an issue where the text of the buttons on the Sync view was being truncated in Japanese.

#### All platforms - PlasticX

All platforms - PlasticX: Error 'CloudLocalAccount' was not found

The key for text CloudLocalAccount has been removed from plastic-gui.en.txt.

***

## 11.0.16.6860

> **Note:**
>
> **Public** | 2022-04-21

### New

#### Command-line client

Command-line client: New variable to track the branch name during an 'update' trigger

When creating an update trigger, the environment variable PLASTIC\_FINAL\_BRANCH is now available to track the branch of the final changeset.

For further info about 'update' triggers click [here](https://www.plasticscm.com/documentation/triggers/plastic-scm-version-control-triggers-guide#Update)

> **Note:**
>
> The `PLASTIC_FINAL_BRANCH` value when switching to an empty child branch will be the parent branch, since the loaded changeset when switching to this empty branch is located at the parent branch.

#### Cloud Server

Cloud Server: Improved x1000 the time cleaning the Jet caches.

The time cleaning the Jet caches could take around 40-50s. This created a lock contention that caused most requests got stuck until the process finished. After this, the server continued working normally.

This code has been improved and it now takes around 50 ms instead 30-50 s (it's 1000 times faster).

### Bug

#### IntelliJ

IntelliJ: VCS controls were not available if the repo contained multiple subprojects.

Now VCS controls are available when a subproject is opened in the IntelliJ IDE (IDEA, Rider and so on) as it now tracks the path upwards until it finds repo info within .plastic directory.

#### Server

Server: Fixed attribute values not updating in the audit log

Previously when attribute values were changed, the previous version would be written to the audit log. Now the current value of the attribute will be written out.

### Alpha new

#### All platforms - PlasticX

All platforms - PlasticX: Custom context menus for Directory conflicts

New context menus will be available in Merge view for each type of directory conflict detected during the merge process.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/814dbc436d36bab2ce3be26260b4fc655c1c08a0788cacb862e672e8c30f2bf9.png)

#### All platforms - PlasticX

All platforms - PlasticX: Unify configuration data

Configuration data has been moved from guiclient.conf to plasticgui.conf in order to unify configuration in just one file. The moved config parameters are: ComparisonMethod, ResultEncoding, Encoding, MergeResolutionType, EnableCreateDynamicWorkspace, ErrorPendingChangesOnSwitch, WarnMergeWithChangedItems.

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Changed column order in History Panel

We changed the column order of History panel in this release, the new column order will be:

-Changeset

-Creation date

-Created by

-Size (PlasticX only)

-Comment

-Branch

#### All platforms - PlasticX, GluonX

All platforms - PlasticX, GluonX: Typing alphanumeric keys will focus selection

We improved keyboard usability, now, when typing alphanumeric keys (a-z, A-Z, 0-9) in any list, selection will focus to the typed item


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/14f37c3868b5d3b6a0f83865a31a935e663db51dfb264204b10a57f50db5a991.gif)

#### All platforms - PlasticX

All platforms - PlasticX: added support for changelists

#### We have added changelists to PlasticX

We have added changelists to PlasticX.

What are changelists?

Changelists are logical groupings of files in the Pending Changes view. They allow you to group your pending changes as you wish, and perform actions only on the files within a group.

For example, you might group changes into a "Core" changelist and a "Tests" changelist. You can then check in or undo the changes in "Core" or "Tests" independently.

You can enable Changelists using the following setting, accessed by clicking Options in the Pending Changes view:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/21341ba196e87ef1eb71066e5d9a39a391fe875f51d01e335894a1e58fbad375.png)

When first enabled, all changes will appear in a "Default" changelist. You can add new changelists from the context menu accessed by right clicking on a changelist name in the pending changes list.

Creating a changelist:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/9e16467d36636b06ba0c3b156e1bd03814d86d9788fe03e94798cea0dd66f70c.png)

A changelist can be persistent or transient. A persistent changelist will remain in the pending changes list even if it contains no changes. Otherwise, the changelist is automatically removed when all it's changes have been checked in or undone.

You can move checked-out files into a changelist by selecting "Move to changelist" from the context menu for that item.

Moving an item to a changelist:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/9a1337d12f479b51de29e6ea9af69affb60255254d7071547c208e772723f9c9.png)

Here is an example with multiple changelists configured:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/8a5b57f1aa826b3eab672036dab1c479376f6f2d8eb8550bbbf04d4a0bed3dae.png)

#### All platforms - PlasticX

All platforms - PlasticX: Added open menu options in Diff window

We added Open and OpenWith right click context menu options in Diff Window and Code Review Windows


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/429f25cc667c49bb3fd8bd71eac51cb286d78fa5ef5547d0924e60611b2c2685.jpg)

### Alpha bug

#### All platforms - Branch Explorer search navigation

All platforms - Branch Explorer search navigation

The search results navigation order was not properly followed in branch explorer, it should be:

1. The parent branches

2. The child branches

3. The changesets

#### All platforms - GluonX

All platforms - GluonX: Solved Enter shortcut in Search files dialog

When Enter key is pressed the selected file in the results table has to be selected and focused in the explorer workspace view from the workspace window.

#### All platforms - PlasticX

All platforms - PlasticX: Diff window opens minimized

Sometimes, if you wanted to diff a branch or a changeset, the diff window hid itself to the background

We have mitigated the issue in this release

#### All platforms - PlasticX

All platforms - PlasticX: Move changesets path TextBox was disabled

Move changesets to a different branch dialog: "Selected branch" TextBox was disabled when the "Selected an existing branch ..." checkbox is checked.

#### Windows - PlasticFS

Windows - PlasticFS: Don't ask to remove Windows Defender rules

PlasticFS was prompting the user to remove a Windows Defender path rule when a dynamic workspace is deleted or moved, even if Windows Defender is not enabled as the default antivirus. Fixed.

***

## 11.0.16.6825

> **Note:**
>
> **Public** | 2022-04-07

### New

#### All platforms - PlasticX

All platforms - PlasticX: Help panel for code reviews

Added Help button and panel to:

* Main window Code Reviews view


  **Screenshot:**
  ![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/06f7b668755d9d5b089d4e517aa721df3af9f370f070231e9ac56223bb9abe1d.png)

* Code Review Window


  **Screenshot:**
  ![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/7fe1239714b0f702aa58466093d6086588288a42e430778fc953481bbe425eff.jpg)

#### Watchdog

Watchdog: Added monitoring for the Plastic Server tcp ports.

The watchdog opens periodically connections against the tcp ports of the Plastic Server instances it started (unsecured tcp & ssl if configured). If the connections cannot be opened by any reason, it will recycle the instance.

#### Watchdog

Watchdog: Added monitoring for the Plastic Server https endpoint.

The watchdog runs periodically requests against the https endpoint of the Plastic Server instances it started (if configured). If the request cannot be completed by any reason, it will recycle the instance.

### Bug

#### Cloud

Cloud: Fixed a concurrency issue with the storage version when creating organizations.

Each time a new organization was created in the Cloud server, it tried to write the storage version file. This could lead to a file access exceptions if two calls tried to write to the file at the very same time.

Now, the storage version is only written once, and the access is protected.

### Alpha new

#### All platforms - PlasticX

All platforms - PlasticX: Added "Browse repository in this label" action

We added a new right click context menu action in Branch Explorer View (when selecting a label) and Labels View


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/022084e1460a62117dcf9add01d28a5ef4ba6c32d4bf4301662c394a799a9e87.jpg)


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/ae21053b38cfb1a8ea4d39c40b524b2bcdb4015b717c8658feaa287797f05183.jpg)

When you click in "Browse repository in this label", a new Split View will appear where you will be able to browse the repository from the selected label's changeset

#### All platforms - PlasticX

All platforms - PlasticX: Fix filter in Code Reviews

We fixed an issue where executing a filter in Code Review, now you can filter using the field "Reviewer"


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/2e31696c839cd985549bacc68a33ac9b56aaf378fd02427727c3f9507b0e6de5.jpg)

#### All platforms - PlasticX

All platforms - PlasticX: New keyboard shortcuts

We added more keyboard shortcuts in PlasticX

Now you can use Ctrl + F (Windows/Linux) or Cmd + F in macOS, to move focus to search filter in all dialogs


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/520f09ad09e4e5e51971880b7187e13f7c012e9d836a1ad8d257968af8a18e51.jpg)

#### All platforms - PlasticX

All platforms - PlasticX: Fix scroll issue in pending changes

In PlasticX, when you had a large number of elements to be added in Pending changes, if you deleted a item the scroll always focused the first element.

Now this behaviour is fixed, the scroll will remain after a delete operation

#### All platforms - PlasticX

All platforms - PlasticX: Added 'Comment' column in the Merge/Incoming Changes views

We completed those views by adding the 'Comment' column in order to show the changeset comment where the revision of each merge/incoming change was created.

For Merge view:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/3c4e75de6b0c4df526c38e62cf82136c8a6fde5c68ca85c2379b90ae17e345af.png)

For Incoming Changes view:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/b81a0992a6a0349e8dc8dfaa16d044f1a0507fb8a602c11b70d5da5e00671737.png)

#### All platforms - GluonX

All platforms - GluonX: Added 'Comment' column in the Incoming Changes view

We completed this view by adding the 'Comment' column in order to show the changeset comment where the revision of each incoming change was created.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/6277d1a59a1617363ef61b3462a5a79194c3e51d2661f333849499d41b30cc93.png)

\[Alpha New]

All platforms - PlasticX: Added recent comments dropdown to Comments dialog

New dropdown button has been added to Comments dialog in order to allow the selection of any comment used previously.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/e97a02bace8cd634a46cb71736450c90d13becc2dcfc6677c5e70ad885c0697a.png)

### Alpha bug

#### All platforms - PlasticX

All platforms - PlasticX: Error displayed creating a new Workspace

In Create Workspace dialog, when trying to choose a repository and the repositories combobox was empty, the app displayed an error message. This error occurs when the repository list wasn't completely loaded.

#### All platforms - GluonX

All platforms - GluonX: fixed directory expansion issue in workspace explorer

We fixed an issue where subdirectories would sometimes become un-expandable after refreshing the view.

#### All platforms - GluonX

All platforms - GluonX: selected search results now highlighted in explorer and configuration view

When you double click on a search result, that item should be navigated to and selected in the item view. This was only happening if the item was already visible. Now, we expand the parent directories of the selected item so it can be shown and selected.

#### All platforms - PlasticX

All platforms - PlasticX: Fix text in Merge View

Merge result text overlapped the panel in Merge diagram, now this issue fixed.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/62e3f48c933d081e62a799e380a9ab8f2f92f63e8d0ecb98ff5060ff61abee56.jpg)

#### Windows - PlasticFS

Windows - PlasticFS: Support Defender exclusions on Windows 11

Starting PlasticFS for the first time on Windows 11 with Windows Defender enabled could show the following error:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/94158162e0ec4dce42a023b99771d28b97cdcd70455e4dd1d6e8278fd44832d3.png)

This happens if the user accepts to add initial exclusion rules to Windows Defender required by PlasticFS to improve its performance.

Now it is fixed, and the error message is gone:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/6c0593424bf06c983441982b48278dbefad9a721367974a51fe0d79c9023ad82.png)

#### All platforms - PlasticX

All platforms - PlasticX: fixed GUI hang during long branch diff calculation

We now offload the diff processing onto a separate thread so that the GUI remains responsive during the branch diff operation.

***

## 11.0.16.6787

> **Note:**
>
> **Public** | 2022-03-31

### New

#### All platforms - DevOps

All platforms - DevOps: Email plug html body messages

Before this version, emails were sent as plain-text. From now on, the email plug can send messages with html content and render them properly.

To do that, just enable the following switch in your email plug configuration (Server's web admin > DevOps > Configure button of your email plug):


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/da8b38ede65fec8e029a387ff67fc1155c4d1680a488c5ba5f49779da53b0ecc.jpg)

#### All platforms - Plastic, PlasticX

All platforms - Plastic, PlasticX: Improvements to Workspace Explorer search

Ctrl+F (Command+F on Mac) to focus on the search field now selects existing text in the field. Also, toggling the "Include private items" checkbox now updates the search results panel if it is open. You can also close the results table by pressing Enter.

### Bug

#### All platforms - Server

All platforms - Server: The plugs and mergebots processes could exit immediately on server startup. Although this issue was easier to reproduce in Linux, it affected all platforms.

An easy way to reproduce this is by restarting the plasticscm-server service on Linux. Once the server is up and running again, you can see that your plugs and mergebots are still offline.

This was because of a race condition when initializing the server. The Plastic SCM server first starts REST APIs, DevOps WebSocket for events… and then it starts the plugs and mergebots.

But the server was still initializing Web services by the time the plugs and mergebots tried to connect to them. This would cause the plug or mergebot to think that the server is offline, forcing them to exit.

The server now checks that these processes are still alive after a grace period. The server will also restart the processes if they exit within this grace period.

#### Windows - Visual Studio Extension

Windows - Visual Studio Extension: Fixed issues with views not being displayed correctly

Now menu buttons in views are displayed correctly at scales greater than 100%.

### Alpha new

#### All platforms - GluonX

All platforms - GluonX: New cross-platform GUI available!

We are pleased to announce the availability of a new cross-platform version of Gluon, code-named GluonX!

We would love for you to try out the new GUI and give us some feedback. GluonX will eventually replace the existing Gluon GUI on all platforms, so this is a great opportunity for you to help shape the future of the application.

This release of GluonX is fully functional, and has great, modern look and feel. It also comes with light and dark theme on all platforms.

Here is how you can launch GluonX:

Windows:

On Windows, run the following in a command window:

```console
C:/Program Files/PlasticSCM5/client/wingluonx.exe
```

MacOS:

On macOS, run the following a terminal window:

```console
open /Applications/PlasticSCM.app/Contents/Applications/GluonX.app
```

Linux:

On Linux, run the following:

```console
/opt/plasticscm5/client/lingluonx
```

Here are a few screenshots to whet your appetite.

Workspace explorer view (dark theme):


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/bbf91f06f054f80165b38f800aa4a28db32d89332ed15cf6be8f3f7a08606410.png)

Checkin view (dark theme):


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/250529df9071ac070360cc1f58357ebe4a4ad2f8090eb7292c9f9eb1405ef7ba.png)

File search (light theme):


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/15402d2ad86f95b07b69e6380cf07745e636d143557bb9986cf4600e9a97bf23.png)

Please try it out and let us know what you think!

#### All platforms - GluonX

All platforms - GluonX: Added support for Changelists

We have added changelists to GluonX.

What are changelists?

Changelists are logical groupings of files in the Checkin view. They allow you to group your pending changes as you wish and perform actions only on the files within a group.

For example, you might group changes into a "Core" changelist and a "Tests" changelist. You can then check in or undo the changes in "Core" or "Tests" independently.

You can enable Changelists using the following setting, accessed by clicking Options in the Checkin view:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/00a179e94609bfae0c5a847caf6170456577c977be9bb2e88e1ef5c8e87b94a3.png)

When first enabled, all changes will appear in a "Default" changelist. You can add new changelists from the context menu accessed by right clicking on a changelist name in the pending changes list.

Creating a changelist:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/7c79b846af5294b83bd439f9593b257b157210506504f9aec1151476cf76669e.png)

A changelist can be persistent or transient. A persistent changelist will remain in the pending changes list even if it contains no changes. Otherwise, the changelist is automatically removed when all its changes have been checked in or undone.

You can move checked-out files into a changelist by selecting "Move to changelist" from the context menu for that item.

Moving an item to a changelist:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/b081a088b7665caa98ac786907ab7cd85e5df04cb35af703ce7fc1d8b96fb64d.png)

Here is an example with multiple changelists configured:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/8b6baef072dbf59fa7d458739b50b723ae42783563b25344740899352b3a9441.png)

#### All platforms, macOS - PlasticX

All platforms, macOS - PlasticX: Improved keyboard shortcuts

We made several improvements, fixes and changes in PlasticX keyboard shortcuts

* Added new delete shortcut in shelves view


  **Screenshot:**
  ![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/a927c8d47a6a26e025de202201e1884e08de8479c06cafde0b98d89fae1c85b6.jpg)

* Added new shortcut in Branch Explorer > Switch workspace to this branch


  **Screenshot:**
  ![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/adedc9952be884c47c64f483682f1780e6eb08d1c953f153a5a27c3fa49a4723.jpg)

* Added new shortcut Ctrl + F, move focus to filter in views


  **Screenshot:**
  ![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/e1bfda0b2cd94b3959af3a5d80f1412ee892cb0199435078a844d44c3fc10986.jpg)

* Fix an issue in pending changes where some shortcuts weren't working properly

  For example, DELETE shortcut was not working if previously a item that couldn't be deleted was selected. Now this issue is fixed

* macOS: Fixed an issue where delete keyboard shortcuts weren't working properly

#### All platforms - PlasticX

All platforms - PlasticX: Fixed the focus for workspace window

Now, we set the focus on the workspace explorer view when the workspace window is opened. So, you can use directly the keyboard to navigate or execute a shortcut (e.g Ctrl+F / Cmd+F to search).

#### All platforms - PlasticX

All platforms - PlasticX: Add support for portable versions

The theme folder can be located in execution root or parent paths. It will be needed in portable versions where all the assemblies and resources are packaged in the same location.

#### Windows - PlasticFS

Windows - PlasticFS: Enable start on user's logon

Now it is possible to start PlasticFS automatically on user's logon by issuing a `plasticfs.exe --install`.

The `plasticfs.exe --install` creates a shortcut (a link file) on user's startup program group.

```text
plasticfs.exe
```

It is located by default at the following directory:

```text
c:\Program Files\PlasticSCM5\client
```

### Alpha bug

#### All platforms - PlasticX

All platforms - PlasticX: Text fields overexpanding when pasting text

When pasting a text that contains end of line character into a single line text field it behaves like a multiline text field instead.

This issue is now fixed, all end of line characters are now replaced with a space character.

#### All platforms - PlasticX

All platforms - PlasticX: Improved clarity of link icon

Link icon present on code review, and diff window now uses the theme colors for dark and light themes, this change improves clarity of this icon on dark theme.

#### All platforms - PlasticX

All platforms - PlasticX: Drawing improvements in the Branch Explorer.

The parent link arrows were drawn over the branch captions. Now they are drawn behind.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/1335b359041aaf2749436e4fc98b3408ab8f62118525257ce240d294491d4226.png)

#### All platforms - PlasticX

All platforms - PlasticX: Error loading invalid formats in image preview

An error was displayed when the image preview was requested for files with PDB and mat formats. This error has been fixed by removing both formats from the supported files formats.

***

## 11.0.16.6757

> **Note:**
>
> **Public** | 2022-03-23

### New

#### Command-line client

Command-line client: Updated the help of the PLASTICEDITOR environment variable available for some commands.

We updated the description about using the PLASTICEDITOR environment variable. You can use this option with the following commands: `branch create`, `label create`, `partial checkin`, `shelveset create`, `archive` and `checkin`.

#### Windows - Visual Studio 2022 plugin

Windows - Visual Studio 2022 plugin: We've made some visual improvements

* Plastic CodeLens now shows real icons instead of ASCII or emoji.

* Changesets marked as "Merged and Changed" are now hidden from the history list avoiding duplicate records.

* Changesets are now ordered by date (and not by the object id).

#### All platforms - PlasticX

All platforms - PlasticX: Added reveal password button

User will be able to display entered passwords for password text boxes.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/cc25966dc9543897e7a765b55cfd64f527512c241e54b85b8b57344757bf9888.jpg)

#### Visual Studio 2022

Visual Studio 2022: CodeLens shows renames greatly!

CodeLens now uses short names rather than fully qualified names for renamed actions to improve legibility.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/652d1609c0e421d9fc3ddb3715326214006e72c8c5efe12bdf721915831851fd.jpg)

#### Server

Server: Improve server stats log

Now the server stats included the queued work and the thread count for the thread pool. See example about what they look like:

```console
2022-03-17 11:07:46,300 ActivityScheduler-59   (null)   INFO  ServerStats - PROCESS INFO
2022-03-17 11:07:46,300 ActivityScheduler-59   (null)   INFO  ServerStats - Entry                                      Value
2022-03-17 11:07:46,300 ActivityScheduler-59   (null)   INFO  ServerStats - ========================    =======================
2022-03-17 11:07:46,300 ActivityScheduler-59   (null)   INFO  ServerStats - Proc Id                                     9015
2022-03-17 11:07:46,304 ActivityScheduler-59   (null)   INFO  ServerStats - Handle count                                 715
2022-03-17 11:07:46,304 ActivityScheduler-59   (null)   INFO  ServerStats - Thread count                                 213
2022-03-17 11:07:46,304 ActivityScheduler-59   (null)   INFO  ServerStats - ThreadPool - Queue length                      0
2022-03-17 11:07:46,304 ActivityScheduler-59   (null)   INFO  ServerStats - ThreadPool - Thread count                     47
```

#### All platforms - PlasticX

All platforms - PlasticX: Support navigating trees with left/right arrow keys.

All the tree views in PlasticX/GluonX now support navigation using left/right arrow keys:

* Right arrow key: If a node is not expanded, it expands it. If it's already expanded, it navigates to the first child.

* Left arrow key: If a node is expanded, collapses it. If it's not expanded, it navigates to the parent node.

#### All platforms - PlasticX

All platforms - PlasticX: Checkboxes inside tables/trees not visible enough.

Increased the contrast colors to make them more noticeable, especially when the checkboxes were unchecked:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/a2b9bc61c70ce02c5ad621533611e87b418040e7eae9d0b04947ee684d82f91c.png)

#### Command-line client

Command-line client: Add option to include delete & move operations in command line history

Using the flag `--moveddeleted` will now show delete & move operations when running `cm history`

For example:

```text
> cm history rev:file2.txt#cs:2 --moveddeleted
D:2/22/2022 02:54 CS:1   B:/main
C: Created a new file
D:2/22/2022 02:54 CS:2   B:Moved from /file1.txt to /file2.txt
C: Renamed the file
D:2/22/2022 02:54 CS:3   B:Removed /file.txt
C: Deleted the file
```

### Bug

#### Command-line client

Command-line client: cm finds nothing when involving unsolvable objects

Before, a query involving inexistent find objects gave zero results and didn't report any error.

```text
# NOTE: The second path is a typo and has no revisions.
cm find revisions where (item='main.c' or item='naim.c')

Total: 0
```

Now queries run as expected:

```text
cm find revisions where (item='main.c' or item='naim.c')

13 14-Mar-22 11:13:00 AM txt owner c:wkmain.c#br:/main/task01#1
23 15-Mar-22 3:29:05 PM txt owner c:wkmain.c#br:/main/task01#2
29 15-Mar-22 4:22:47 PM txt owner c:wkmain.c#br:/main/task02#3

Total: 3
```

#### All Platforms - PlasticX

All Platforms - PlasticX: Fixed error adding a new Code Review comment.

When opening a Code Review from a PlasticLink, and then trying to add a new comment, the UI displayed an "An unexpected error has occurred" error message. Now it's fixed.

#### All platforms - PlasticX

All platforms - PlasticX: Fixed text editor's search box visibility.

When you change a file in the diff viewer (both pending changes view and diff window), and the text editor's search box was visible, the search box was wrongly hidden, and it couldn't be displayed again. Now it's fixed.

#### Command-line client

Command-line client: Archive can use an external text editor for comments.

Some commands use the PLASTICEDITOR environment variable to specify an editor for entering comments. If the PLASTICEDITOR environment variable is set, and the comment is empty, the editor will be automatically launched to allow you to specify the comment.

The 'cm archive' command disclaimed this was possible, but it didn't work. Now it is fixed.

We also fixed the help of other 2 commands (merge and create attribute), which also allowed this functionality, but it was not documented.

### Alpha new

#### All platforms - PlasticX

All platforms - PlasticX: Added diff selection differences

We added "diff selection" and "diff with previous selection" right-click context menu events in all Diff windows.

Now you can easily compare your custom selected code lines differences in a separate window


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/b0ff85a10a3ac7ea5133a044d9bf9d26a05f1ba1523b14a734fad62afbadb859.jpg)

### Alpha bug

#### All platforms - PlasticX

All platforms - PlasticX: Flat button background

Background for flat buttons have been removed

***

## 11.0.16.6718

> **Note:**
>
> **Public** | 2022-03-17

### New

#### All platforms - Server

All platforms - Server: Migrate database from SQLServer/MySQL to Jet

We enabled the database migration from supported SQL backends (MySQL and SQLServer) to Jet using the server's WebAdmin utility.

We plan to deprecate the SQL backends soon. So, if you're still running your on-prem Plastic Server with MySQL or SQLServer as database backend, we strongly recommend to migrate to Jet backend soon (our own embedded, super-fast repo storage).

To access to the migration tool, just open the Plastic Server's WebAdmin (Usually on `http://localhost:7178`) >> `Configuration` >> `Repository Storage`


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/cfc84ae9342fac7ee620abd9917c4b9adaaa59a8db149590d833d088737d33b8.png)

And then, click on `Change storage`

(You will only see this option if your server is using MySQL or SQLServer as database backend)


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/96d7786af4e51b73302eec11c04cc9bc510e568a9f942b482dc212750a30acfc.png)

And finally, while migrating, you should see a screen like this:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/84933a8605acb36794ffae79c3f53dacec70a7a27ca5bb197e506f28b2918990.png)

#### Command-line client

Command-line client: Edited the help of the `transformed` formatting option of the `ls` command.

The `transformed` formatting option now includes a note about reading the [Administrator guide](https://www.plasticscm.com/documentation/administration/plastic-scm-version-control-administrator-guide#Chapter17:Transformableworkspaces) to learn more about Transformable workspaces.

#### Windows - Proxy

Windows - Proxy: Service management using plasticd proxy subcommands.

Now it is possible to install, uninstall, start & stop Plastic Proxy service by using `plasticd proxy` subcommands:

* `plasticd proxy --installservice` -> installs the "Plastic Proxy" service (it does not start it up)

* `plasticd proxy --start` -> starts the "Plastic Proxy" service

* `plasticd proxy --stop` -> stops the "Plastic Proxy" service

* `plasticd proxy --restart` -> restarts the "Plastic Proxy" service

* `plasticd proxy --status` -> prints the status of the "Plastic Proxy" service

* `plasticd proxy --uninstallservice` -> stops and uninstalls the "Plastic Proxy" service

For further info about the Plastic Proxy see [this link](https://www.plasticscm.com/documentation/administration/plastic-scm-version-control-administrator-guide#Chapter4:Usingaproxyserver)

For the proper way of working of the proxy server, remember creating a `plasticcached.network.conf` config file in the Plastic SCM server installation directory.

Example of `C:\Program Files\PlasticSCM5\server\plasticcached.network.conf` :

```text
[
  {
    "port": 8085,
    "type": "tcp",
    "security": "none"
  }
]
```

(You can find a copy of this example config file in  `C:\Program Files\PlasticSCM5\server\config_samples` directory).

#### macOS - PlasticX

macOS - PlasticX: Plastic links are handled by PlasticX

Now, when clicking on a plastic link, it will be directly opened in PlasticX, without asking you with which version of Plastic you want to open it.

#### Command-line client

Command-line client: Updated the help by removing the `{type}` format option of the `gettaskbranches` command.

Because all Plastic SCM branches are of type "smart" since a long time ago, we removed the `{type}` format option of the `gettaskbranches` command. This type displayed if a branch was "smart" or not.

#### Command-line client

Command-line client: Edited the help of the `log`, `ls`, and `history` commands.

We added a note in the help of the `log`, `ls`, and `history` commands to let you know that the options `--xml` and `--format` cannot be combined. These commands will ignore the `--format` option if you run them using both options.

### Bug

#### All platforms - Command-line client

All platforms - Command-line client: The 'cm changelist' command could not add removed items to a changelist. That now works OK.

Say for example you have a changelist named "TODO", and a removed item named "license.txt". The command below did not work:

```text
cm changelist TODO add license.txt
[code]

This was because of the way the changelist command was calculating the workspace status to identify the change you wanted to add to the changelist. This is now fixed.
```

#### All platforms - Plastic, PlasticX

All platforms - Plastic, PlasticX: corrected handling of multiple arguments in custom tools

External tools configured with multiple arguments were incorrectly having their arguments grouped into a single argument. We fixed that and now the arguments are correctly sent to the target executable.

#### All platforms - Web UI

All platforms - Web UI: Fixed issues with repo names with forward slashes

Fixed an issue where WebUI would hang when it encountered repo names that include forward slashes

#### Cloud Server

Cloud Server: Fixed finding archived revisions.

The `cm find revs where archived='T'` command didn't return anything if executed against a Cloud repo. It didn't matter if achived='T' or ='F' was specified, it returned zero results in both cases.

Now, it behaves like on-premise servers and it returns the right results according to the specified find conditions.

```console
cm find revs where size > 0 AND archived='T' on repository 'repo@org@cloud'
227      03/04/2022 12:07:08 bin ruben    /wk/help/light/unitysignupbuhoshechristmas.png#br:/main#1
246      03/04/2022 12:07:08 bin ruben    /wk/help/light/unitysignupbuhochristmas.png#br:/main#1

Total: 2
```

Bear in mind that these changes will affect only those files archived from this version. Old archived ones won't be affected and therefore not displayed as results.

#### All platforms - PlasticX

All platforms - PlasticX: Preserve Properties and Attributes when refreshing the Branch Explorer.

When refreshing the Branch Explorer, PlasticX lost the properties and attributes for the selected branch/changeset/label. Now it's fixed.

### Alpha new

#### All platforms - PlasticX

All platforms - PlasticX: Implemented Branch Explorer display options.

Included the following options in the Branch Explorer:

* Display branches: Allows to enable/disable the visualization of branches.

* Display full branch names: Display the full-path/name-only for child branches (/main/new-feature/task5531 vs task5531).

* Display merge links: Allows to enable/disable the visualization of merge links.

* Display cross-branch changeset links: Allows to enable/disable the visualization changeset parent links that start in a branch and end in a different branch.

* Display labels: Allows to enable/disable the visualization of labels.

* Display branch task info: If enabled, Plastic SCM the task info from the issue tracker next to the branch name. If Plastic SCM is not connected to an issue tracker, the branch description is displayed.

We also improved the text layout when the option "Display branch task info" is enabled. The branch name is displayed in bold text and the task info is displayed on grayed smaller text, to improve readability.

See it in action:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/a453be9680cbcdb639bf3a92141441e7af25ad8c75b864491a3f0be5ad753a1b.gif)

#### All platforms - PlasticX

All platforms - PlasticX: Visual feedback when cutting items

When cutting items from the workspace explorer view, now there is a transparency effect in the icon of the elements that have been cut:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/9e946be328ca1e604d164fac1cdcffc072eac64b20b47ff0ff2729bb06745551.png)

Also, now you can clear the cut elements by pressing the Escape key.

#### PlasticX

PlasticX: Support over 100 image formats for Image Differences.

We added [ImageMagick](https://imagemagick.org/) support for our "preview generators". That means that now we can display differences for over [100 major image file formats](https://imagemagick.org/script/formats.php).


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/51819125297125bdc9767180e175441c0eeecc260031df5c7871d93c3d2c74e1.gif)

#### All platforms - PlasticX

All platforms - PlasticX: Updated behavior of show shelves view button

We updated the behavior of the "Show shelves" button in the pending changes view. Now, when the view is visible, the button is activated, and clicking on it again will close the view.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/629a120c6f12f0b523a38f08e8085f8e1ffb6e874d3382cc86ad086ac4bb6564.png)

#### All platforms - PlasticX

All platforms - PlasticX: Improved keyboard shortcuts

We added a new shortcut in Workspace Explorer: now you can use Shift+Ctrl+S in Windows/Linux, or Shift+Cmd+S in Mac, if you want to quick access Open In Explorer

We also exchanged shortcuts for Open and Checkout operations:

Open: Shift+Ctrl+O in Windows/Linux, Shift+Cmd+O in Mac

Checkout: Ctrl+O in Windows/Linux, Cmd+O in Mac


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/e1bfda0b2cd94b3959af3a5d80f1412ee892cb0199435078a844d44c3fc10986.jpg)

#### All platforms - PlasticX

All platforms - PlasticX: Tabs styling

Tab styling has been modified to improve visibility of selected item and have a better look and feel on high resolution screens


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/f6201705b169cd9b47cdb5568d33040e61b4c91a30bc72654b718662fbc17bfc.png)

### Alpha bug

#### All platforms - PlasticX

All platforms - PlasticX: Cannot close preferences without signing in

An issue that affected enterprise users that uses SSO Authentication could not close the preferences window unless the user is re-authenticated.

#### All platforms - PlasticX

All platforms - PlasticX: Fixed context menu display on empty tables

The context menu is needed to be displayed in empty tables to allow create new items. This functionality has been provided using the right click over the table body region and it's disabled from the table header region.

***

## 11.0.16.6683

> **Note:**
>
> **Public** | 2022-03-10

### New

#### All platforms

All platforms: Plastic 11 is out!

Plastic SCM reaches major version 11. It's been almost 16 years since Plastic initial release and here we go for another big milestone.

\== What was released during the last year ==

* Plastic Server and Command Line fully ported to the newest .net framework. Good bye to Mono and .Net framework, hello to .net 6!

* Added plastic links support for Code Reviews. [10.0.16.5338](https://www.plasticscm.com/download/releasenotes/10.0.16.5338)

* Added plastic links support for Gluon in macOS. [10.0.16.5432](https://www.plasticscm.com/download/releasenotes/10.0.16.5432)

* New Code Review experience in WebUI. [10.0.16.5338](https://www.plasticscm.com/download/releasenotes/10.0.16.5338)

* Huge merge calculation performance improvements in the server. [10.0.16.5362](https://www.plasticscm.com/download/releasenotes/10.0.16.5362)

* Greatly improved workspace metadata format for great performance. [10.0.16.5574](https://www.plasticscm.com/download/releasenotes/10.0.16.5574)

* TeamCity plugin: Versioned settings. [10.0.16.5574](https://www.plasticscm.com/download/releasenotes/10.0.16.5574)

* Wildcard support in repo trigger filters. [10.0.16.5615](https://www.plasticscm.com/download/releasenotes/10.0.16.5615)

* Improvements in visual studio plugin. Sln and csprojs not modified anymore. [10.0.16.5664](https://www.plasticscm.com/download/releasenotes/10.0.16.5664)

* Version auto-upgrade for the client. [10.0.16.5668](https://www.plasticscm.com/download/releasenotes/10.0.16.5668)

* Checkin performance greatly improved by setting multi-thread defaults. [10.0.16.5710](https://www.plasticscm.com/download/releasenotes/10.0.16.5710)

* Improved Active Directory security and performance. [10.0.16.5816](https://www.plasticscm.com/download/releasenotes/10.0.16.5816)

* Wake On Lan support added to clients. [10.0.16.5859](https://www.plasticscm.com/download/releasenotes/10.0.16.5859)

* Gluon: custom actions for changesets. [10.0.16.5859](https://www.plasticscm.com/download/releasenotes/10.0.16.5859)

* Dynamic workspaces released in alpha. [Dynamic workspaces for windows](https://blog.plasticscm.com/2021/07/dynamic-workspaces-alpha-for-windows.html)

* GitSync now supports LFS when syncing from GitHub Enterprise servers, GitLab and Bitbucket! [10.0.16.5975](https://www.plasticscm.com/download/releasenotes/10.0.16.5975)

* Added support to install Plastic SCM in Debian 11. [10.0.16.6112](https://www.plasticscm.com/download/releasenotes/10.0.16.6112)

* Triggers can now run from Global Config. [10.0.16.6141](https://www.plasticscm.com/download/releasenotes/10.0.16.6141)

* Single Sign On support in Plastic Cloud.

* Added parallel download for big files. Much faster workspace updates. [10.0.16.6241](https://www.plasticscm.com/download/releasenotes/10.0.16.6241)

* Greatly reduced memory footprint during workspace update. [10.0.16.6241](https://www.plasticscm.com/download/releasenotes/10.0.16.6241)

* Plastic Cloud can now archive revisions. [10.0.16.6241](https://www.plasticscm.com/download/releasenotes/10.0.16.6241)

* New cross-platform desktop GUIs released in alpha. [10.0.16.6363](https://www.plasticscm.com/download/releasenotes/10.0.16.6363)

* Support for Visual Studio 2022. [10.0.16.6419](https://www.plasticscm.com/download/releasenotes/10.0.16.6419)

* New "cm api" client-side REST API replaces the old plasticapi and introduces tons of improvements, including support for partial workspaces.

* Added --machinereadable flag to many commands to ease automation. [10.0.16.6443](https://www.plasticscm.com/download/releasenotes/10.0.16.6443)

* And the new cross-platform GUI made official for macOS and Linux. [10.0.16.6621](https://www.plasticscm.com/download/releasenotes/10.0.16.6621)

* Greatly improved "pending changes" performace. [10.0.16.6621](https://www.plasticscm.com/download/releasenotes/10.0.16.6621)

* Visual Studio 2022 plugin gains CodeLens support. [10.0.16.6656](https://www.plasticscm.com/download/releasenotes/10.0.16.6656)

Besides hundreds of bugfixes, usability improvements, better localization in asian languages, and many more.

#### Windows - Visual Studio 2022 plugin

Windows - Visual Studio 2022 plugin: VS CodeLens improvements

This new release improves the relevant information shown in CodeLens for an annotated element.

Fixes the management of local changes, showing them as the most relevant ones if exist.

Shows incoming changesets available in the codelens message

Improves the history list ordering it by date and tagging current changeset and incoming changes with representative icons.

Take a look to it!


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/05d37edc534c2660661d6ff1d436ca14c4951ed7c6ecee726251fe1630512174.jpg)

Note: This feature is installed as part of the Visual Studio 2022 Plastic SCM extension if you select the option during the Plastic SCM installation process. Once installed, the Plastic SCM CodeLens provider can be enable/disable from Tools > Options > Text Editor - All Languages - CodeLens > Show Plastic SCM

#### All platforms - Server

All platforms - Server: Migrate database from SQLServer/MySQL to Jet

We enabled the database migration from supported SQL backends (MySQL and SQLServer) to Jet using the server's WebAdmin utility.

We plan to deprecate the SQL backends soon. So, if you're still running your on-prem Plastic Server with MySQL or SQLServer as database backend, we strongly recommend to migrate to Jet backend soon (our own embedded, super-fast repo storage).

To access to the migration tool, just open the Plastic Server's WebAdmin (Usually on `http://localhost:7178`) >> `Configuration` >> `Repository Storage`).


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/cfc84ae9342fac7ee620abd9917c4b9adaaa59a8db149590d833d088737d33b8.png)

And then, click on `Change storage`

(You will only see this option if your server is using MySQL or SQLServer as database backend)


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/96d7786af4e51b73302eec11c04cc9bc510e568a9f942b482dc212750a30acfc.png)

And finally, while migrating, you should see a screen like this:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/84933a8605acb36794ffae79c3f53dacec70a7a27ca5bb197e506f28b2918990.png)

#### All platforms - Plastic, Gluon

All platforms - Plastic, Gluon: Modified message when adding ignored rules

We updated the text in the check box inside the ignored rules panel.

Now it's clearer that the rules will be applied only to the user's local workspaces, and not to everyone's.


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/3c749d41236ba43aa69e6501700869694a0d2011c4b6e43c43bbe81ec337ac70.png)

### Bug

#### All platforms - Web UI

All platforms - Web UI: Fixed issues with repo names with parenthesis

Fixed an issue where WebUI would hang when it encountered repo names that include parenthesis.

#### All platforms - DevOps

All platforms - DevOps: Trunkbot auto enqueue branches when new changes in dst branch.

Back in release [10.0.16.6621](https://www.plasticscm.com/download/releasenotes/10.0.16.6621), we published this new feature: If new changesets reach your trunk branch (i.e., '/main' branch) while a merge changeset -changes of your own branch and the trunk branch- is being built & tested, trunkbot would queue again the branch, repeating all the branch processing, including the last changes from trunk branch in a new merge changeset.

But we missed to queue the branch again in the scenario where the trunkbot activates the "Process reviewed branches only" setting. Now it is fixed and affected branch will be queued again also with this configuration.

Remember enabling the auto-queue branches that failed due to changes detected in the trunk branch in the trunkbot configuration:


**Screenshot:**
![Screenshot](/api/media?file=/unity-version-control/media/images/release-notes/img/949c93c7dd58ac3da384f810b3d65d0bea386385b028de0ee39e1ba829d3f5c6.png)

#### Server

Server: Do not stop accepting client connections if something fails.

The connections accept loop was protected in the server so if there is something wrong handling a client connection, the whole accept thread doesn't stop working.

### Alpha bug

#### All platforms - PlasticX

All platforms - PlasticX: The syntax highlight was lost switching the diff mode.

When switching from "Text differences" to "Semantic differences" and vice versa, the syntax highlight colors were lost for text editors. Now it's fixed.

#### All platforms - PlasticX

All platforms - PlasticX: The GUI was stuck when pasting text in the right diff editor.

In this scenario, the GUI got stuck sometimes:

* Copy text to the clipboard from another text source.

* Go back to Plastic SCM.

* Select Ctrl + A to select all text in the diff's right editor.

* Hit Ctrl + V to paste that text.

Now that scenario works fine.

***
