function mergeGuidelines(base, guidelines) {
  return base.replace(
    /{{SLOT:guidelines}}[\s\S]*?{{\/SLOT:guidelines}}/,
    guidelines.join('\n\n')
  );
}